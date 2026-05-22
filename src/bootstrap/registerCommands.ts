// src/bootstrap/registerCommands.ts
import type { BootstrapContext } from './context';
import { setupCommand }        from '../commands/setup';
import { configCommand }       from '../commands/config';
import { doctorCommand }       from '../commands/doctor';
import { ticketCloseCommand }  from '../commands/ticket-close';
import { ticketAddCommand }    from '../commands/ticket-add';
import { ticketRemoveCommand } from '../commands/ticket-remove';
import { ticketRenameCommand } from '../commands/ticket-rename';
import { ticketClaimCommand }  from '../commands/ticket-claim';
import { oldmanChannelCommand } from '../commands/oldman-channel';
import { clearCommand }        from '../commands/clear';
import { streamerCommand }     from '../commands/streamer';
import { ticketArchivCommand } from '../commands/ticket-archiv';
import { syncImportCommand }   from '../commands/sync-import';
import { announceCommand }     from '../commands/announce';
import { wipeCommand }         from '../commands/wipe';

export function registerCommands(ctx: BootstrapContext): void {
  for (const cmd of [
    setupCommand, configCommand, doctorCommand,
    ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
    ticketRenameCommand, ticketClaimCommand, oldmanChannelCommand,
    clearCommand, streamerCommand, ticketArchivCommand,
    syncImportCommand, announceCommand, wipeCommand,
  ]) {
    ctx.commands.set(cmd.data.name, cmd);
  }
  ctx.logger.info(`[bootstrap] ${ctx.commands.size} Commands registriert.`);
}
