import type { ButtonInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { closeTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketConfirmCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CONFIRM_CLOSE,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    await interaction.update({ content: '🔒 Ticket wird geschlossen...', embeds: [], components: [] });
    await closeTicket(interaction.guild, channelId, interaction.member);
  },
};
