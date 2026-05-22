import type { BootstrapContext } from './context';
import { setupOldManLore } from '../features/oldManLore';
import { setupChangelogDashboard } from '../features/changelogDashboard';
import { registerEventSyncListeners } from '../features/discordSync/eventListeners';

export function registerFeatures(ctx: BootstrapContext): void {
  try {
    setupOldManLore(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupOldManLore fehlgeschlagen:', err);
  }

  try {
    setupChangelogDashboard(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupChangelogDashboard fehlgeschlagen:', err);
  }

  try {
    registerEventSyncListeners(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] registerEventSyncListeners fehlgeschlagen:', err);
  }
}
