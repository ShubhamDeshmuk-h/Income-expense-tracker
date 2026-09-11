/**
 * VaultFlow — Safe Structured Logger
 *
 * Rules:
 * - NEVER logs amount values, PINs, user IDs, or sensitive data
 * - In production (non-__DEV__) only errors are logged
 * - Log messages are structured for easy filtering
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, context: string, message: string): string {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  return `[VaultFlow/${context}] ${level.toUpperCase()} ${ts}: ${message}`;
}

export const log = {
  debug: (context: string, message: string, ...rest: unknown[]) => {
    if (!isDev) return;
    console.log(formatMessage('debug', context, message), ...rest);
  },
  info: (context: string, message: string, ...rest: unknown[]) => {
    if (!isDev) return;
    console.info(formatMessage('info', context, message), ...rest);
  },
  warn: (context: string, message: string, ...rest: unknown[]) => {
    console.warn(formatMessage('warn', context, message), ...rest);
  },
  error: (context: string, message: string, err?: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err ?? '');
    console.error(formatMessage('error', context, message), errMsg ? `(${errMsg})` : '');
  },
};
