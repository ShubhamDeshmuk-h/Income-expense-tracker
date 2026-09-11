import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('vaultflow.db');
  }
  return db;
}

async function ensureInitialized() {
  const database = await getDatabase();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      mode TEXT NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash', 'bank')),
      category TEXT NOT NULL DEFAULT 'Other',
      amount REAL NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      attachment_uri TEXT,
      is_automated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);
}

export type Transaction = {
  id: number;
  type: 'income' | 'expense';
  mode: 'cash' | 'bank';
  category: string;
  amount: number;
  date: string;
  note: string;
  attachment_uri: string | null;
  is_automated: number;
  created_at: string;
  updated_at: string;
};

export type TransactionImport = Omit<Transaction, 'id'>;

export type BalanceSummary = {
  mode: string;
  total_income: number;
  total_expense: number;
  current_balance: number;
};

export type RestoreMergeResult = {
  imported: number;
  skipped: number;
  failed: number;
};

export async function initializeDatabase() {
  await ensureInitialized();
}

export async function getTransactions(): Promise<Transaction[]> {
  await ensureInitialized();
  const database = await getDatabase();
  return database.getAllAsync<Transaction>(
    'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
  );
}

export async function getTransactionsByDateRange(
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  await ensureInitialized();
  const database = await getDatabase();
  return database.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE date BETWEEN ? AND ? ORDER BY date DESC',
    [startDate, endDate]
  );
}

export async function addTransaction(
  tx: Omit<TransactionImport, 'created_at' | 'updated_at'>
): Promise<number> {
  await ensureInitialized();
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO transactions (type, mode, category, amount, date, note, attachment_uri, is_automated, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.type,
      tx.mode,
      tx.category,
      tx.amount,
      tx.date,
      tx.note || '',
      tx.attachment_uri || null,
      tx.is_automated || 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number,
  tx: Partial<TransactionImport>
): Promise<void> {
  await ensureInitialized();
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE transactions SET
      type = COALESCE(?, type),
      mode = COALESCE(?, mode),
      category = COALESCE(?, category),
      amount = COALESCE(?, amount),
      date = COALESCE(?, date),
      note = COALESCE(?, note),
      attachment_uri = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      tx.type || null,
      tx.mode || null,
      tx.category || null,
      tx.amount || null,
      tx.date || null,
      tx.note || null,
      tx.attachment_uri !== undefined ? tx.attachment_uri : null,
      now,
      id,
    ]
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  await ensureInitialized();
  const database = await getDatabase();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function clearAllTransactions(): Promise<void> {
  await ensureInitialized();
  const database = await getDatabase();
  await database.execAsync('DELETE FROM transactions');
}

export async function getBalanceSummary(): Promise<BalanceSummary[]> {
  await ensureInitialized();
  const database = await getDatabase();
  return database.getAllAsync<BalanceSummary>(`
    SELECT
      mode,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as current_balance
    FROM transactions
    GROUP BY mode
  `);
}

export async function getMonthlySummary(year: number, month: number) {
  await ensureInitialized();
  const database = await getDatabase();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const result = await database.getFirstAsync<{
    total_income: number;
    total_expense: number;
  }>(
    `SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
     FROM transactions WHERE date BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return result || { total_income: 0, total_expense: 0 };
}

export async function getCategoryBreakdown(
  type: 'income' | 'expense',
  startDate?: string,
  endDate?: string
) {
  await ensureInitialized();
  const database = await getDatabase();
  const dateFilter =
    startDate && endDate ? 'AND date BETWEEN ? AND ?' : '';
  const params: (string | number)[] = [type];
  if (startDate && endDate) params.push(startDate, endDate);

  return database.getAllAsync<{ category: string; total: number; count: number }>(
    `SELECT category, SUM(amount) as total, COUNT(*) as count
     FROM transactions WHERE type = ? ${dateFilter}
     GROUP BY category ORDER BY total DESC`,
    params
  );
}

export async function replaceAllTransactions(
  records: TransactionImport[]
): Promise<void> {
  await ensureInitialized();
  const database = await getDatabase();
  await database.execAsync('DELETE FROM transactions');
  for (const record of records) {
    await database.runAsync(
      `INSERT INTO transactions (type, mode, category, amount, date, note, attachment_uri, is_automated, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.type,
        record.mode,
        record.category,
        record.amount,
        record.date,
        record.note || '',
        record.attachment_uri || null,
        record.is_automated || 0,
        record.created_at || new Date().toISOString(),
        record.updated_at || record.created_at || new Date().toISOString(),
      ]
    );
  }
}

function normalizeTextValue(input?: string | null) {
  return (input || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildDedupeKey(
  record: Pick<
    TransactionImport,
    'type' | 'mode' | 'category' | 'amount' | 'date' | 'note'
  >
) {
  const amount = Number(record.amount || 0).toFixed(2);
  return [
    record.type,
    record.mode,
    normalizeTextValue(record.category),
    amount,
    record.date,
    normalizeTextValue(record.note),
  ].join('|');
}

export async function mergeTransactions(
  records: TransactionImport[]
): Promise<RestoreMergeResult> {
  await ensureInitialized();
  const existing = await getTransactions();
  const existingKeys = new Set(
    existing.map((item) =>
      buildDedupeKey({
        type: item.type,
        mode: item.mode,
        category: item.category,
        amount: Number(item.amount),
        date: item.date,
        note: item.note || '',
      })
    )
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const database = await getDatabase();

  for (const record of records) {
    const normalized: TransactionImport = {
      type: record.type === 'income' ? 'income' : 'expense',
      mode: record.mode === 'bank' ? 'bank' : 'cash',
      category: record.category || 'Other',
      amount: Number(record.amount) || 0,
      date: record.date || new Date().toISOString().split('T')[0],
      note: record.note || '',
      attachment_uri: record.attachment_uri || null,
      is_automated: record.is_automated || 0,
      created_at: record.created_at || new Date().toISOString(),
      updated_at:
        record.updated_at || record.created_at || new Date().toISOString(),
    };

    if (normalized.amount <= 0) {
      failed += 1;
      continue;
    }

    const dedupeKey = buildDedupeKey(normalized);
    if (existingKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    try {
      await database.runAsync(
        `INSERT INTO transactions (type, mode, category, amount, date, note, attachment_uri, is_automated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.type,
          normalized.mode,
          normalized.category,
          normalized.amount,
          normalized.date,
          normalized.note,
          normalized.attachment_uri || null,
          normalized.is_automated || 0,
          normalized.created_at,
          normalized.updated_at,
        ]
      );
      imported += 1;
      existingKeys.add(dedupeKey);
    } catch {
      failed += 1;
    }
  }

  return { imported, skipped, failed };
}
