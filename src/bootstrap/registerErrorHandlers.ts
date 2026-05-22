// src/bootstrap/registerErrorHandlers.ts
import type { BootstrapContext } from './context';

export function registerErrorHandlers(ctx: BootstrapContext): void {
  process.on('uncaughtException', (err) => {
    ctx.logger.error('[process] uncaughtException:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    ctx.logger.error('[process] unhandledRejection:', reason);
  });

  process.on('SIGTERM', () => {
    ctx.logger.info('[process] SIGTERM empfangen — graceful shutdown');
    ctx.client.destroy();
    process.exit(0);
  });
}
