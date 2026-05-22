import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type {
  Command, ButtonHandler, SelectMenuHandler,
  ChannelSelectMenuHandler, RoleSelectMenuHandler, ModalHandler,
  UserSelectMenuHandler,
} from './types';
import { parseId } from './utils/ids';
import { replyError } from './utils/errors';
import { logger } from './utils/logger';
import { trackInteractionEvent } from './analytics/analytics.db';
import { env } from './config/env';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

export const commands = new Collection<string, Command>();
export const buttonHandlers = new Map<string, ButtonHandler>();
export const selectMenuHandlers = new Map<string, SelectMenuHandler>();
export const channelSelectHandlers = new Map<string, ChannelSelectMenuHandler>();
export const roleSelectHandlers = new Map<string, RoleSelectMenuHandler>();
export const modalHandlers = new Map<string, ModalHandler>();
export const userSelectHandlers = new Map<string, UserSelectMenuHandler>();

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      const t0 = Date.now();
      let cmdSuccess = true;
      try {
        await command.execute(interaction);
      } catch (err) {
        cmdSuccess = false;
        logger.error('[commands] Interaktion fehlgeschlagen:', err);
        if (interaction.isRepliable()) {
          await replyError(
            interaction as Parameters<typeof replyError>[0],
            'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'
          ).catch(() => void 0);
        }
      } finally {
        if (env.ANALYTICS_ENABLED && interaction.guildId) {
          try {
            trackInteractionEvent({
              guildId:         interaction.guildId,
              interactionType: 'command',
              commandName:     interaction.commandName,
              feature:         interaction.commandName,
              success:         cmdSuccess,
              durationMs:      Date.now() - t0,
              errorType:       cmdSuccess ? null : 'execution_error',
            });
          } catch { /* never let analytics crash the bot */ }
        }
      }
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

    if (interaction.isUserSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = userSelectHandlers.get(prefix);
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
    logger.error('[interactions] Unbehandelter Fehler:', err);
    if (interaction.isRepliable()) {
      await replyError(
        interaction as Parameters<typeof replyError>[0],
        'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'
      ).catch(() => void 0);
    }
  }
});
