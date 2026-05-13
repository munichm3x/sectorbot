import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { isSupport, isAdmin } from '../services/permissionService';
import { claimTicket } from '../services/ticketService';
import { createSuccessEmbed, createErrorEmbed } from '../services/embedService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketClaimCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-claim')
    .setDescription('Übernimmt dieses Ticket'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!isSupport(interaction.member, interaction.guildId) && !isAdmin(interaction.member)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Tickets übernehmen.');
    }

    if (ticket.claimed_by) {
      return interaction.reply({
        embeds: [createErrorEmbed(`Dieses Ticket wurde bereits übernommen von <@${ticket.claimed_by}>.`)],
        ephemeral: true,
      });
    }

    const success = await claimTicket(interaction.guild, interaction.channelId, interaction.member);
    if (!success) return replyError(interaction, 'Übernehmen fehlgeschlagen.');

    await interaction.reply({
      embeds: [createSuccessEmbed(`📌 <@${interaction.member.id}> hat das Ticket übernommen.`)],
    });
  },
};
