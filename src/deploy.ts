import { REST, Routes } from 'discord.js';
import { env } from './config/env';
import { setupCommand } from './commands/setup';
import { configCommand } from './commands/config';
import { doctorCommand } from './commands/doctor';
import { ticketCloseCommand } from './commands/ticket-close';
import { ticketAddCommand } from './commands/ticket-add';
import { ticketRemoveCommand } from './commands/ticket-remove';
import { ticketRenameCommand } from './commands/ticket-rename';
import { ticketClaimCommand } from './commands/ticket-claim';
import { oldmanChannelCommand } from './commands/oldman-channel';
import { clearCommand } from './commands/clear';
import { logger } from './utils/logger';

const commandList = [
  setupCommand, configCommand, doctorCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand, oldmanChannelCommand, clearCommand,
];

const rest = new REST().setToken(env.DISCORD_TOKEN);

(async () => {
  logger.info(`Registriere ${commandList.length} Slash Commands (global)...`);
  const data = await rest.put(
    Routes.applicationCommands(env.CLIENT_ID),
    { body: commandList.map(c => c.data.toJSON()) },
  ) as unknown[];
  logger.info(`${data.length} Commands erfolgreich registriert.`);
})().catch(err => {
  logger.error('Command-Deployment fehlgeschlagen', err);
  process.exit(1);
});
