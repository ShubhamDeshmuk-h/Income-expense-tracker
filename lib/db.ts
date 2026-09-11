/**
 * VaultFlow — Database Layer
 *
 * All SQLite access goes through this module — no raw SQL in UI components.
 *
 * Money representation:
 *   - Stored as INTEGER `amount_cents` (e.g. ₹100.50 → 10050)
 *   - Displayed via `centsToAmount()` helper → 10050 / 100 = 100.50
 *   - All arithmetic is done on integers to avoid floating-point errors
 *   - Legacy `amount REAL` column kept for backward compat but not used for calculations
 */

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;
let initialized = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('vaultflow.db');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  const database = await getDatabase();
  await runMigrations(database);
  initialized = true;
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Converts a float amount (e.g. 100.50) to integer cents (10050). */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Converts integer cents (10050) to float amount (100.50). */
export function centsToAmount(cents: number): number {
  return cents / 100;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'bank' | 'upi' | 'card' | 'atm' | 'other';
export type TransactionSource = 'manual' | 'sms' | 'ocr' | 'import';

export type Transaction = {
  id: number;
  type: 'income' | 'expense';
  mode: 'cash' | 'bank'; // legacy — kept for compat
  payment_method: PaymentMethod;
  category: string;
  merchant: string;
  amount_cents: number; // canonical — use this for math
  amount: number;       // legacy REAL — do not use for arithmetic
  date: string;         // YYYY-MM-DD
  note: string;
  tx_ref: string | null;
  source: TransactionSource;
  confidence: number;
  attachment_uri: string | null;
  is_automated: number;
  created_at: string;
  updated_at: string;
};

export type TransactionInput = {
  type: 'income' | 'expense';
  payment_method: PaymentMethod;
  category: string;
  merchant?: string;
  amount: number; // float — converted to cents internally
  date: string;
  note?: string;
  tx_ref?: string | null;
  source?: TransactionSource;
  confidence?: number;
  attachment_uri?: string | null;
};

export type BalanceSummary = {
  mode: string;
  total_income_cents: number;
  total_expense_cents: number;
  current_balance_cents: number;
};

export type RestoreMergeResult = {
  imported: number;
  skipped: number;
  failed: number;
};

export type MonthlyTrend = {
  year: number;
  month: number;
  income_cents: number;
  expense_cents: number;
};

export type CategoryBreakdown = {
  category: string;
  total_cents: number;
  count: number;
};

export type MerchantBreakdown = {
  merchant: string;
  total_cents: number;
  count: number;
};

// ---------------------------------------------------------------------------
// Payment method helpers
// ---------------------------------------------------------------------------

/** Maps payment_method to its display mode (cash/bank) for backward compat */
export function paymentMethodToMode(pm: PaymentMethod): 'cash' | 'bank' {
  return pm === 'cash' ? 'cash' : 'bank';
}

// ---------------------------------------------------------------------------
// CRUD — Transactions
// ---------------------------------------------------------------------------

export async function getTransactions(): Promise<Transaction[]> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getAllAsync<Transaction>(
    `SELECT * FROM transactions ORDER BY date DESC, created_at DESC`
  );
}

/**
 * Paginated transaction fetch for history screen.
 * Returns `limit` records starting at `offset`.
 */
export async function getTransactionsPaginated(
  offset: number,
  limit: number
): Promise<Transaction[]> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getAllAsync<Transaction>(
    `SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

/**
 * Search transactions across merchant, note, category fields.
 */
export async function searchTransactions(query: string): Promise<Transaction[]> {
  await initializeDatabase();
  const database = await getDatabase();
  const pattern = `%${query.trim()}%`;
  return database.getAllAsync<Transaction>(
    `SELECT * FROM transactions
     WHERE merchant LIKE ? OR note LIKE ? OR category LIKE ?
     ORDER BY date DESC, created_at DESC
     LIMIT 100`,
    [pattern, pattern, pattern]
  );
}

/**
 * Get transactions with optional filters.
 */
export async function getFilteredTransactions(params: {
  type?: 'income' | 'expense';
  category?: string;
  payment_method?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  await initializeDatabase();
  const database = await getDatabase();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (params.type) { conditions.push('type = ?'); args.push(params.type); }
  if (params.category) { conditions.push('category = ?'); args.push(params.category); }
  if (params.payment_method) { conditions.push('payment_method = ?'); args.push(params.payment_method); }
  if (params.startDate) { conditions.push('date >= ?'); args.push(params.startDate); }
  if (params.endDate) { conditions.push('date <= ?'); args.push(params.endDate); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  return database.getAllAsync<Transaction>(
    `SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );
}

export async function addTransaction(input: TransactionInput): Promise<number> {
  await initializeDatabase();
  const database = await getDatabase();
  const now = new Date().toISOString();
  const cents = amountToCents(input.amount);
  const mode = paymentMethodToMode(input.payment_method);

  const result = await database.runAsync(
    `INSERT INTO transactions
      (type, mode, payment_method, category, merchant, amount_cents, amount,
       date, note, tx_ref, source, confidence, attachment_uri, is_automated, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.type,
      mode,
      input.payment_method,
      input.category,
      input.merchant ?? '',
      cents,
      input.amount, // legacy float column
      input.date,
      input.note ?? '',
      input.tx_ref ?? null,
      input.source ?? 'manual',
      input.confidence ?? 1.0,
      input.attachment_uri ?? null,
      input.source !== 'manual' ? 1 : 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number,
  input: Partial<TransactionInput>
): Promise<void> {
  await initializeDatabase();
  const database = await getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (input.type !== undefined) { sets.push('type = ?'); args.push(input.type); }
  if (input.payment_method !== undefined) {
    sets.push('payment_method = ?'); args.push(input.payment_method);
    sets.push('mode = ?'); args.push(paymentMethodToMode(input.payment_method));
  }
  if (input.category !== undefined) { sets.push('category = ?'); args.push(input.category); }
  if (input.merchant !== undefined) { sets.push('merchant = ?'); args.push(input.merchant); }
  if (input.amount !== undefined) {
    const cents = amountToCents(input.amount);
    sets.push('amount_cents = ?'); args.push(cents);
    sets.push('amount = ?'); args.push(input.amount);
  }
  if (input.date !== undefined) { sets.push('date = ?'); args.push(input.date); }
  if (input.note !== undefined) { sets.push('note = ?'); args.push(input.note); }
  if (input.attachment_uri !== undefined) { sets.push('attachment_uri = ?'); args.push(input.attachment_uri ?? null); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?'); args.push(now);
  args.push(id);

  await database.runAsync(
    `UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  await initializeDatabase();
  const database = await getDatabase();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ?', [id]
  ) ?? null;
}

export async function clearAllTransactions(): Promise<void> {
  await initializeDatabase();
  const database = await getDatabase();
  await database.execAsync('DELETE FROM transactions');
}

export async function getTransactionCount(): Promise<number> {
  await initializeDatabase();
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions'
  );
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Analytics queries
// ---------------------------------------------------------------------------

export async function getBalanceSummary(): Promise<BalanceSummary[]> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getAllAsync<BalanceSummary>(`
    SELECT
      mode,
      SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) as total_income_cents,
      SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as total_expense_cents,
      SUM(CASE WHEN type = 'income' THEN amount_cents ELSE -amount_cents END) as current_balance_cents
    FROM transactions
    GROUP BY mode
  `);
}

export async function getMonthlySummary(
  year: number,
  month: number
): Promise<{ total_income_cents: number; total_expense_cents: number }> {
  await initializeDatabase();
  const database = await getDatabase();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const result = await database.getFirstAsync<{
    total_income_cents: number;
    total_expense_cents: number;
  }>(
    `SELECT
      SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) as total_income_cents,
      SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as total_expense_cents
     FROM transactions WHERE date BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return result ?? { total_income_cents: 0, total_expense_cents: 0 };
}

export async function getCategoryBreakdown(
  type: 'income' | 'expense',
  startDate?: string,
  endDate?: string
): Promise<CategoryBreakdown[]> {
  await initializeDatabase();
  const database = await getDatabase();
  const dateFilter = startDate && endDate ? 'AND date BETWEEN ? AND ?' : '';
  const params: (string | number)[] = [type];
  if (startDate && endDate) params.push(startDate, endDate);

  return database.getAllAsync<CategoryBreakdown>(
    `SELECT category, SUM(amount_cents) as total_cents, COUNT(*) as count
     FROM transactions WHERE type = ? ${dateFilter}
     GROUP BY category ORDER BY total_cents DESC`,
    params
  );
}

/**
 * Returns monthly income/expense trend for the last N months.
 * Used for sparkline charts on dashboard.
 */
export async function getMonthlyTrend(months: number = 6): Promise<MonthlyTrend[]> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getAllAsync<MonthlyTrend>(
    `SELECT
      CAST(strftime('%Y', date) AS INTEGER) as year,
      CAST(strftime('%m', date) AS INTEGER) as month,
      SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) as income_cents,
      SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as expense_cents
     FROM transactions
     WHERE date >= date('now', ? || ' months')
     GROUP BY year, month
     ORDER BY year ASC, month ASC`,
    [`-${months}`]
  );
}

/**
 * Returns top merchants by spend in a given period.
 */
export async function getMerchantBreakdown(
  type: 'income' | 'expense',
  startDate?: string,
  endDate?: string,
  limit: number = 10
): Promise<MerchantBreakdown[]> {
  await initializeDatabase();
  const database = await getDatabase();
  const dateFilter = startDate && endDate ? 'AND date BETWEEN ? AND ?' : '';
  const params: (string | number)[] = [type];
  if (startDate && endDate) params.push(startDate, endDate);
  params.push(limit);

  return database.getAllAsync<MerchantBreakdown>(
    `SELECT
      CASE WHEN merchant = '' THEN category ELSE merchant END as merchant,
      SUM(amount_cents) as total_cents,
      COUNT(*) as count
     FROM transactions
     WHERE type = ? AND (merchant != '' OR category != '') ${dateFilter}
     GROUP BY merchant
     ORDER BY total_cents DESC
     LIMIT ?`,
    params
  );
}

export async function getTransactionsByDateRange(
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  await initializeDatabase();
  const database = await getDatabase();
  return database.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE date BETWEEN ? AND ? ORDER BY date DESC',
    [startDate, endDate]
  );
}

// ---------------------------------------------------------------------------
// Backup / Restore
// ---------------------------------------------------------------------------

/** Fetch all transactions for backup export. */
export async function getAllTransactionsForBackup(): Promise<Transaction[]> {
  return getTransactions();
}

/**
 * Replaces all transactions (used in full restore).
 * Runs in a transaction for safety.
 */
export async function replaceAllTransactions(
  records: TransactionInput[]
): Promise<void> {
  await initializeDatabase();
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.execAsync('DELETE FROM transactions');
    for (const record of records) {
      const cents = amountToCents(record.amount);
      const mode = paymentMethodToMode(record.payment_method);
      const now = new Date().toISOString();
      await database.runAsync(
        `INSERT INTO transactions
          (type, mode, payment_method, category, merchant, amount_cents, amount,
           date, note, tx_ref, source, confidence, attachment_uri, is_automated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.type,
          mode,
          record.payment_method,
          record.category,
          record.merchant ?? '',
          cents,
          record.amount,
          record.date,
          record.note ?? '',
          record.tx_ref ?? null,
          record.source ?? 'import',
          record.confidence ?? 1.0,
          record.attachment_uri ?? null,
          1,
          now,
          now,
        ]
      );
    }
  });
}

/**
 * Merge-restores transactions from a backup with duplicate detection.
 * Duplicate key: type + payment_method + category + amount_cents + date + normalized_note
 */
export async function mergeTransactions(
  records: TransactionInput[]
): Promise<RestoreMergeResult> {
  await initializeDatabase();
  const existing = await getTransactions();

  function buildKey(r: {
    type: string;
    payment_method: string;
    category: string;
    amount: number;
    date: string;
    note: string;
    tx_ref?: string | null;
  }): string {
    const cents = amountToCents(Number(r.amount) || 0);
    const note = (r.note ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    // If tx_ref is present, it's the canonical dedup key
    if (r.tx_ref) return `txref:${r.tx_ref}`;
    return `${r.type}|${r.payment_method}|${r.category.toLowerCase()}|${cents}|${r.date}|${note}`;
  }

  const existingKeys = new Set(
    existing.map((t) => buildKey({
      type: t.type,
      payment_method: t.payment_method,
      category: t.category,
      amount: centsToAmount(t.amount_cents),
      date: t.date,
      note: t.note,
      tx_ref: t.tx_ref,
    }))
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records) {
    if (!record.type || !record.date || !record.amount || record.amount <= 0) {
      failed += 1;
      continue;
    }
    const key = buildKey({
      type: record.type,
      payment_method: record.payment_method ?? 'cash',
      category: record.category,
      amount: record.amount,
      date: record.date,
      note: record.note ?? '',
      tx_ref: record.tx_ref,
    });
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    try {
      await addTransaction({ ...record, source: record.source ?? 'import' });
      existingKeys.add(key);
      imported += 1;
    } catch {
      failed += 1;
    }
  }

  return { imported, skipped, failed };
}
