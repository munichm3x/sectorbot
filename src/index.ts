import { env } from './config/env';
import { initDb } from './db/index';
import { logger } from './utils/logger';
import {
  client, commands, buttonHandlers, selectMenuHandlers,
  channelSelectHandlers, roleSelectHandlers, modalHandlers,
} from './client';
import { setupOldManLore } from './features/oldManLore';
import { setupChangelogDashboard } from './features/changelogDashboard';
import { changelogButtonHandler } from './interactions/buttons/changelogButtonHandler';
import { changelogModalHandler } from './interactions/modals/changelogModalHandler';

// Commands
import { setupCommand } from './commands/setup';
import { configCommand } from './commands/config';
import { doctorCommand } from './commands/doctor';
import { ticketCloseCommand } from './commands/ticket-close';
import { ticketAddCommand } from './commands/ticket-add';
import { ticketRemoveCommand } from './commands/ticket-remove';
import { ticketRenameCommand } from './commands/ticket-rename';
import { ticketClaimCommand } from './commands/ticket-claim';
import { oldmanChannelCommand } from './commands/oldman-channel';

// Select Menus
import { ticketCategoryHandler } from './interactions/selectMenus/ticketCategory';

// Buttons
import { ticketCloseHandler } from './interactions/buttons/closeTicket';
import { ticketConfirmCloseHandler } from './interactions/buttons/confirmClose';
import { ticketCancelCloseHandler } from './interactions/buttons/cancelClose';
import { ticketClaimHandler } from './interactions/buttons/claimTicket';
import { ticketAddPromptHandler } from './interactions/buttons/addUserPrompt';
import { ticketRemovePromptHandler } from './interactions/buttons/removeUserPrompt';
import { acceptRulesHandler } from './interactions/buttons/acceptRules';
import { setupButtonDispatcher } from './interactions/buttons/setup/setupDispatcher';

// Channel + Role Selects
import { setupChannelSelectDispatcher } from './interactions/channelSelects/setupChannelSelectDispatcher';
import { setupRoleSelectDispatcher } from './interactions/roleSelects/setupRoleSelectDispatcher';

// Modals
import { ticketAddModalHandler } from './interactions/modals/ticketAddModal';
import { ticketRemoveModalHandler } from './interactions/modals/ticketRemoveModal';
import { setupAddCategoryModal } from './interactions/modals/setupAddCategoryModal';

// Register commands
for (const cmd of [
  setupCommand, configCommand, doctorCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand, oldmanChannelCommand,
]) {
  commands.set(cmd.data.name, cmd);
}

// Register select menus
selectMenuHandlers.set(ticketCategoryHandler.prefix, ticketCategoryHandler);

// Register buttons
for (const handler of [
  ticketCloseHandler, ticketConfirmCloseHandler, ticketCancelCloseHandler,
  ticketClaimHandler, ticketAddPromptHandler, ticketRemovePromptHandler,
  acceptRulesHandler, setupButtonDispatcher, changelogButtonHandler,
]) {
  buttonHandlers.set(handler.prefix, handler);
}

// Register channel + role selects
channelSelectHandlers.set(setupChannelSelectDispatcher.prefix, setupChannelSelectDispatcher);
roleSelectHandlers.set(setupRoleSelectDispatcher.prefix, setupRoleSelectDispatcher);

// Register modals
modalHandlers.set(ticketAddModalHandler.prefix, ticketAddModalHandler);
modalHandlers.set(ticketRemoveModalHandler.prefix, ticketRemoveModalHandler);
modalHandlers.set(setupAddCategoryModal.prefix, setupAddCategoryModal);
modalHandlers.set(changelogModalHandler.prefix, changelogModalHandler);

client.once('ready', (c) => {
  logger.info(`Bot online: ${c.user.tag} (${c.user.id})`);
  logger.info(`Commands: ${commands.size} | Buttons: ${buttonHandlers.size}`);
});

initDb(env.DATABASE_PATH);
setupOldManLore(client);
setupChangelogDashboard(client);
client.login(env.DISCORD_TOKEN);
