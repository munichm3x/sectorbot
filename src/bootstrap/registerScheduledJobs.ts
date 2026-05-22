// src/bootstrap/registerScheduledJobs.ts
import type { BootstrapContext } from './context';
import { setupScumStatus } from '../features/scumStatus/scumStatus.updater';
import { setupStreamerChecker } from '../features/streamer/streamer.checker';
import { setupTicketAutoClose } from '../features/ticketAutoClose';

export function registerScheduledJobs(ctx: BootstrapContext): void {
  try {
    setupScumStatus(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupScumStatus fehlgeschlagen:', err);
  }

  try {
    setupStreamerChecker(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupStreamerChecker fehlgeschlagen:', err);
  }

  try {
    setupTicketAutoClose(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupTicketAutoClose fehlgeschlagen:', err);
  }
}
