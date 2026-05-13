import { inspect } from 'util';

type Level = 'info' | 'warn' | 'error' | 'debug';

function format(level: Level, ...args: unknown[]): string {
  const ts = new Date().toISOString();
  const parts = args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: 3 })));
  return `[${ts}] [${level.toUpperCase()}] ${parts.join(' ')}`;
}

export const logger = {
  info:  (...args: unknown[]) => console.info(format('info',  ...args)),
  warn:  (...args: unknown[]) => console.warn(format('warn',  ...args)),
  error: (...args: unknown[]) => console.error(format('error', ...args)),
  debug: (...args: unknown[]) => console.debug(format('debug', ...args)),
};
