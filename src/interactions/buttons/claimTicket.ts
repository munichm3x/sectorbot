import type { ButtonInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { isSupport, isAdmin } from '../../services/permissionService';
import { claimTicket } from '../../services/ticketService';
import { createSuccessEmbed, createErrorEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketClaimHandler: ButtonHandler = {
  prefix: IDS.TICKET_CLAIM,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!isSupport(interaction.member, interaction.guildId) && !isAdmin(interaction.member)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Tickets übernehmen.');
    }
    if (ticket.claimed_by) {
      return interaction.reply({
        embeds: [createErrorEmbed(`Dieses Ticket wurde bereits übernommen von <@${ticket.claimed_by}>.`)],
        ephemeral: true,
      });
    }

    const success = await claimTicket(interaction.guild, channelId, interaction.member);
    if (!success) return replyError(interaction, 'Übernehmen fehlgeschlagen.');

    await interaction.reply({
      embeds: [createSuccessEmbed(`📌 <@${interaction.member.id}> hat das Ticket übernommen.`)],
    });
  },
};
