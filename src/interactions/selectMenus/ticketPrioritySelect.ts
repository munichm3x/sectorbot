import {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  type ButtonInteraction, type StringSelectMenuInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { setPriority } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
import type { ButtonHandler, SelectMenuHandler } from '../../types';

export const ticketPriorityPromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_PRIORITY_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Nur Support-Mitglieder können die Priorität setzen.');
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(makeId(IDS.TICKET_PRIORITY, channelId))
      .setPlaceholder('Priorität auswählen...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🟢 Niedrig').setValue('low').setDescription('Kein zeitlicher Druck'),
        new StringSelectMenuOptionBuilder().setLabel('🟡 Mittel').setValue('medium').setDescription('Standard-Priorität'),
        new StringSelectMenuOptionBuilder().setLabel('🔴 Hoch').setValue('high').setDescription('Zeitkritisch'),
        new StringSelectMenuOptionBuilder().setLabel('🚨 Dringend').setValue('urgent').setDescription('Sofortiger Handlungsbedarf'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: '🔺 Wähle eine Priorität:', components: [row], ephemeral: true });
  },
};

export const ticketPrioritySelectHandler: SelectMenuHandler = {
  prefix: IDS.TICKET_PRIORITY,

  async execute(interaction: StringSelectMenuInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
    const priority = interaction.values[0];
    if (!priority || !ALLOWED_PRIORITIES.includes(priority as typeof ALLOWED_PRIORITIES[number])) {
      return replyError(interaction, 'Ungültige Priorität.');
    }

    await setPriority(interaction.guild, channelId, priority);
    await interaction.update({ content: `✅ Priorität auf **${priority}** gesetzt.`, components: [] });
  },
};
