/**
 * VaultFlow — Backup Module
 *
 * Backup format: versioned JSON with checksum integrity verification.
 *
 * Security rules:
 * - Never store PIN, biometric secrets, or recovery answers in backup
 * - Backup includes only non-secret settings and financial data
 * - Checksum validates backup integrity before restore
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { getAllTransactionsForBackup, mergeTransactions, replaceAllTransactions, type Transaction, type TransactionInput } from './db';
import { getCurrencyPreference, type CurrencyPreference } from './preferences';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Backup format types
// ---------------------------------------------------------------------------

export const BACKUP_VERSION = 3;

export interface VaultFlowBackup {
  backupVersion: number;
  schemaVersion: number;
  createdAt: string;
  appVersion: string;
  checksum: string; // SHA-256 of payload (computed without this field)
  metadata: {
    transactionCount: number;
    currencyCode: string;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
    exportedBy: 'manual' | 'auto';
  };
  settings: BackupSettings;
  currency: CurrencyPreference;
  transactions: SerializedTransaction[];
}

export interface BackupSettings {
  monthlySummaryAlerts: boolean;
  largeTransactionThreshold: number;
  largeTransactionAlerts: boolean;
  lowBalanceThreshold: number;
  lowBalanceAlerts: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly' | 'off';
  // Intentionally omitted: PIN, biometric secrets, recovery answers
}

/** Serialized transaction — floats serialized safely, no undefined values */
export interface SerializedTransaction {
  type: 'income' | 'expense';
  payment_method: string;
  category: string;
  merchant: string;
  amount: number; // float representation for human readability
  amount_cents: number;
  date: string;
  note: string;
  tx_ref: string | null;
  source: string;
  confidence: number;
  attachment_uri: null; // Attachments are never backed up (file URIs are device-specific)
  created_at: string;
  updated_at: string;
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: VaultFlowBackup['metadata'];
  schemaVersion?: number;
  transactionCount?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Backup directory
// ---------------------------------------------------------------------------

const BACKUP_DIR = `${FileSystem.documentDirectory}vaultflow/backups/`;

async function ensureBackupDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

async function computeChecksum(payload: Omit<VaultFlowBackup, 'checksum'>): Promise<string> {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, json);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'user_settings';

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  monthlySummaryAlerts: true,
  largeTransactionThreshold: 10000,
  largeTransactionAlerts: true,
  lowBalanceThreshold: 1000,
  lowBalanceAlerts: true,
  autoBackupFrequency: 'weekly',
};

export async function createBackup(options: {
  exportedBy?: 'manual' | 'auto';
  share?: boolean;
} = {}): Promise<{ path: string; backup: VaultFlowBackup }> {
  await ensureBackupDir();

  const [transactions, currency, settingsJson] = await Promise.all([
    getAllTransactionsForBackup(),
    getCurrencyPreference(),
    SecureStore.getItemAsync(SETTINGS_KEY),
  ]);
  const schemaVersion = 3; // Current schema version

  const settings: BackupSettings = settingsJson
    ? { ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(settingsJson) }
    : DEFAULT_BACKUP_SETTINGS;

  const serializedTx: SerializedTransaction[] = transactions.map(serializeTransaction);

  const dates = transactions.map((t) => t.date).sort();

  const payloadWithoutChecksum: Omit<VaultFlowBackup, 'checksum'> = {
    backupVersion: BACKUP_VERSION,
    schemaVersion,
    createdAt: new Date().toISOString(),
    appVersion: '2.0.0',
    metadata: {
      transactionCount: serializedTx.length,
      currencyCode: currency.currencyCode,
      dateRangeStart: dates[0] ?? null,
      dateRangeEnd: dates[dates.length - 1] ?? null,
      exportedBy: options.exportedBy ?? 'manual',
    },
    settings,
    currency,
    transactions: serializedTx,
  };

  const checksum = await computeChecksum(payloadWithoutChecksum);
  const backup: VaultFlowBackup = { ...payloadWithoutChecksum, checksum };

  const filename = `vaultflow_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const path = `${BACKUP_DIR}${filename}`;

  await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2), {
    encoding: 'utf8' as any,
  });

  if (options.share !== false) {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Save VaultFlow Backup',
        UTI: 'public.json',
      });
    }
  }

  return { path, backup };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validateBackupFile(uri: string): Promise<BackupValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: string;
  try {
    raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' as any });
  } catch {
    return { valid: false, errors: ['Could not read backup file.'], warnings: [] };
  }

  if (!raw || raw.trim().length === 0) {
    return { valid: false, errors: ['Backup file is empty.'], warnings: [] };
  }

  let backup: unknown;
  try {
    backup = JSON.parse(raw);
  } catch {
    return { valid: false, errors: ['Backup file is not valid JSON. It may be corrupted.'], warnings: [] };
  }

  if (typeof backup !== 'object' || backup === null) {
    return { valid: false, errors: ['Backup file structure is invalid.'], warnings: [] };
  }

  const b = backup as Record<string, unknown>;

  // Version checks
  if (typeof b.backupVersion !== 'number') {
    errors.push('Missing or invalid backup version.');
  } else if (b.backupVersion > BACKUP_VERSION) {
    warnings.push(`This backup was created by a newer version of VaultFlow (v${b.backupVersion}). Some data may not be restored correctly.`);
  }

  // Transactions
  if (!Array.isArray(b.transactions)) {
    errors.push('Backup is missing the transactions list.');
  } else {
    const invalidTx = (b.transactions as unknown[]).filter((t) => {
      if (typeof t !== 'object' || t === null) return true;
      const tx = t as Record<string, unknown>;
      return !tx.type || !tx.date || (typeof tx.amount !== 'number' && typeof tx.amount_cents !== 'number');
    });
    if (invalidTx.length > 0) {
      warnings.push(`${invalidTx.length} transaction(s) have missing or invalid fields and will be skipped.`);
    }
  }

  // Currency
  if (!b.currency || typeof b.currency !== 'object') {
    warnings.push('Backup is missing currency settings. Default currency will be used.');
  }

  // Checksum verification (if present)
  if (b.checksum && typeof b.checksum === 'string') {
    const { checksum: _, ...rest } = b as unknown as VaultFlowBackup;
    try {
      const expectedChecksum = await computeChecksum(rest as Omit<VaultFlowBackup, 'checksum'>);
      if (expectedChecksum !== b.checksum) {
        warnings.push('Backup checksum mismatch. The file may have been modified or partially corrupted.');
      }
    } catch {
      warnings.push('Could not verify backup integrity.');
    }
  } else {
    warnings.push('Backup has no integrity checksum (older format). Proceeding with caution.');
  }

  const txList = Array.isArray(b.transactions) ? (b.transactions as unknown[]) : [];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: b.metadata as VaultFlowBackup['metadata'],
    schemaVersion: typeof b.schemaVersion === 'number' ? b.schemaVersion : undefined,
    transactionCount: txList.length,
  };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function pickAndValidateBackup(): Promise<{
  uri: string;
  validation: BackupValidationResult;
  raw: string;
} | null> {
  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
  } catch {
    return null;
  }

  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const validation = await validateBackupFile(uri);
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' as any }).catch(() => '');

  return { uri, validation, raw };
}

export async function importBackup(
  raw: string,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  let backup: VaultFlowBackup;
  try {
    backup = JSON.parse(raw) as VaultFlowBackup;
  } catch {
    return { success: false, imported: 0, skipped: 0, failed: 0, error: 'Invalid backup file.' };
  }

  const txInputs: TransactionInput[] = (backup.transactions ?? [])
    .map(deserializeTransaction)
    .filter((t): t is TransactionInput => t !== null);

  try {
    if (mode === 'replace') {
      await replaceAllTransactions(txInputs);
      // Restore settings
      if (backup.settings) {
        await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(backup.settings));
      }
      if (backup.currency?.currencyCode) {
        const { setCurrencyPreference } = await import('./preferences');
        await setCurrencyPreference(backup.currency);
      }
      return { success: true, imported: txInputs.length, skipped: 0, failed: 0 };
    } else {
      const result = await mergeTransactions(txInputs);
      if (backup.currency?.currencyCode) {
        const { setCurrencyPreference } = await import('./preferences');
        await setCurrencyPreference(backup.currency);
      }
      return { success: true, ...result };
    }
  } catch (err) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      error: err instanceof Error ? err.message : 'Restore failed.',
    };
  }
}

// ---------------------------------------------------------------------------
// Local backup management
// ---------------------------------------------------------------------------

export async function listLocalBackups(): Promise<string[]> {
  try {
    await ensureBackupDir();
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => `${BACKUP_DIR}${f}`)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function deleteBackup(path: string): Promise<void> {
  await FileSystem.deleteAsync(path, { idempotent: true });
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeTransaction(tx: Transaction): SerializedTransaction {
  return {
    type: tx.type,
    payment_method: tx.payment_method ?? 'cash',
    category: tx.category ?? 'Other',
    merchant: tx.merchant ?? '',
    amount: tx.amount_cents / 100,
    amount_cents: tx.amount_cents,
    date: tx.date,
    note: tx.note ?? '',
    tx_ref: tx.tx_ref ?? null,
    source: tx.source ?? 'manual',
    confidence: tx.confidence ?? 1.0,
    attachment_uri: null, // never back up device-local URIs
    created_at: tx.created_at,
    updated_at: tx.updated_at,
  };
}

function deserializeTransaction(raw: unknown): TransactionInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = raw as Record<string, unknown>;

  const type = t.type === 'income' ? 'income' : 'expense';
  const amount = typeof t.amount_cents === 'number'
    ? t.amount_cents / 100
    : typeof t.amount === 'number' ? t.amount : 0;

  if (amount <= 0) return null;

  const date = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
    ? t.date
    : new Date().toISOString().split('T')[0];

  const paymentMethod = ['cash', 'bank', 'upi', 'card', 'atm', 'other'].includes(String(t.payment_method))
    ? (t.payment_method as any)
    : (t.mode === 'bank' ? 'bank' : 'cash');

  return {
    type,
    payment_method: paymentMethod,
    category: typeof t.category === 'string' ? t.category : 'Other',
    merchant: typeof t.merchant === 'string' ? t.merchant : '',
    amount,
    date,
    note: typeof t.note === 'string' ? t.note : '',
    tx_ref: typeof t.tx_ref === 'string' ? t.tx_ref : null,
    source: 'import',
    confidence: typeof t.confidence === 'number' ? t.confidence : 1.0,
    attachment_uri: null,
  };
}
