import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { createCloseConfirmEmbed } from '../services/embedService';
import { makeId, IDS } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketCloseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Schließt das aktuelle Ticket'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) {
      return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    }
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Du hast keine Berechtigung, dieses Ticket zu schließen.');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CONFIRM_CLOSE, interaction.channelId))
        .setLabel('Schließen bestätigen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CANCEL_CLOSE, interaction.channelId))
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [createCloseConfirmEmbed()], components: [row], ephemeral: true });
  },
};
