// src/bootstrap/registerDashboard.ts
import type { Client } from 'discord.js';
import type { BootstrapContext } from './context';

export function registerDashboard(ctx: BootstrapContext): void {
  if (!ctx.env.DASHBOARD_ENABLED) return;
  ctx.client.once('ready', () => {
    import('../dashboard/server')
      .then(({ startDashboard }: { startDashboard: (c: Client) => void }) => {
        startDashboard(ctx.client);
      })
      .catch((err: unknown) => ctx.logger.error('[dashboard] Startfehler:', err));
  });
}
