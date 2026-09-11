/**
 * VaultFlow — Versioned Database Migrations
 *
 * Rules:
 * - Each migration is idempotent (safe to run multiple times)
 * - Migrations run in a transaction; failure rolls back
 * - Never delete data in a migration; only add or transform
 * - Always bump CURRENT_SCHEMA_VERSION when adding a migration
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const CURRENT_SCHEMA_VERSION = 3;

interface Migration {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — transactions table',
    up: async (db) => {
      await db.execAsync(`
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
    },
  },
  {
    version: 2,
    description: 'Add merchant, payment_method, tx_ref, source, confidence columns',
    up: async (db) => {
      // Use separate statements — SQLite ALTER TABLE supports only one ADD COLUMN per statement
      const existingColumns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(transactions)`
      );
      const colNames = new Set(existingColumns.map((c) => c.name));

      if (!colNames.has('merchant')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN merchant TEXT DEFAULT ''`);
      }
      if (!colNames.has('payment_method')) {
        await db.execAsync(
          `ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`
        );
      }
      if (!colNames.has('tx_ref')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN tx_ref TEXT DEFAULT NULL`);
      }
      if (!colNames.has('source')) {
        await db.execAsync(
          `ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`
        );
      }
      if (!colNames.has('confidence')) {
        await db.execAsync(
          `ALTER TABLE transactions ADD COLUMN confidence REAL NOT NULL DEFAULT 1.0`
        );
      }

      // Additional indexes for filter-heavy queries
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
        CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
        CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
      `);
    },
  },
  {
    version: 3,
    description: 'Add amount_cents for precise financial arithmetic',
    up: async (db) => {
      const existingColumns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(transactions)`
      );
      const colNames = new Set(existingColumns.map((c) => c.name));

      if (!colNames.has('amount_cents')) {
        // Add the column, then populate from existing REAL amount values
        await db.execAsync(
          `ALTER TABLE transactions ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0`
        );
        // Populate amount_cents from existing float amounts
        await db.execAsync(
          `UPDATE transactions SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_cents = 0`
        );
      }
    },
  },
];

/**
 * Ensures the schema_version table exists and returns the current DB version.
 */
async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT NOT NULL DEFAULT ''
    )
  `);
  const row = await db.getFirstAsync<{ version: number }>(
    `SELECT MAX(version) as version FROM schema_version`
  );
  return row?.version ?? 0;
}

/**
 * Run all pending migrations in order.
 * Each migration is wrapped in a transaction for safety.
 * Logs migration progress without exposing sensitive data.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Enable WAL for better concurrency and crash safety
  await db.execAsync(`PRAGMA journal_mode = WAL`);
  await db.execAsync(`PRAGMA foreign_keys = ON`);

  const currentVersion = await getSchemaVersion(db);
  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return;
  }

  for (const migration of pending) {
    try {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          `INSERT INTO schema_version (version, applied_at, description) VALUES (?, datetime('now'), ?)`,
          [migration.version, migration.description]
        );
      });
    } catch (err) {
      // Migration failed — transaction already rolled back
      throw new Error(
        `VaultFlow migration v${migration.version} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}

/**
 * Returns the current schema version without running migrations.
 */
export async function getCurrentSchemaVersion(db: SQLiteDatabase): Promise<number> {
  try {
    return await getSchemaVersion(db);
  } catch {
    return 0;
  }
}
