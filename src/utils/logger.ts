import { inspect } from 'util';

type Level = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  ts:      string;
  level:   Level;
  message: string;
}

// In-memory ring buffer — last 500 entries. Used by the dashboard log stream.
const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 500;

function pushToBuffer(level: Level, message: string): void {
  LOG_BUFFER.push({ ts: new Date().toISOString(), level, message });
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

/** Returns a snapshot of current log buffer (safe to iterate). */
export function getLogBuffer(): LogEntry[] {
  return [...LOG_BUFFER];
}

function format(level: Level, ...args: unknown[]): string {
  const ts    = new Date().toISOString();
  const parts = args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: 3 })));
  return `[${ts}] [${level.toUpperCase()}] ${parts.join(' ')}`;
}

export const logger = {
  info: (...args: unknown[]) => {
    const msg = format('info', ...args);
    console.info(msg);
    pushToBuffer('info', msg);
  },
  warn: (...args: unknown[]) => {
    const msg = format('warn', ...args);
    console.warn(msg);
    pushToBuffer('warn', msg);
  },
  error: (...args: unknown[]) => {
    const msg = format('error', ...args);
    console.error(msg);
    pushToBuffer('error', msg);
  },
  debug: (...args: unknown[]) => {
    const msg = format('debug', ...args);
    console.debug(msg);
    pushToBuffer('debug', msg);
  },
};
