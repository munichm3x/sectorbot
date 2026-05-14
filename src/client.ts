import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type {
  Command, ButtonHandler, SelectMenuHandler,
  ChannelSelectMenuHandler, RoleSelectMenuHandler, ModalHandler,
} from './types';
import { parseId } from './utils/ids';
import { replyError } from './utils/errors';
import { logger } from './utils/logger';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

export const commands = new Collection<string, Command>();
export const buttonHandlers = new Map<string, ButtonHandler>();
export const selectMenuHandlers = new Map<string, SelectMenuHandler>();
export const channelSelectHandlers = new Map<string, ChannelSelectMenuHandler>();
export const roleSelectHandlers = new Map<string, RoleSelectMenuHandler>();
export const modalHandlers = new Map<string, ModalHandler>();

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = buttonHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = selectMenuHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = channelSelectHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isRoleSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = roleSelectHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isModalSubmit()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = modalHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }
  } catch (err) {
    logger.error('Interaction-Fehler', err);
    if (interaction.isRepliable()) {
      await replyError(
        interaction as Parameters<typeof replyError>[0],
        'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'
      ).catch(() => void 0);
    }
  }
});
