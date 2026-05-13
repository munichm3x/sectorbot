import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { removeUserFromTicket } from '../../services/ticketService';
import { createSuccessEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketRemoveModalHandler: ModalHandler = {
  prefix: IDS.TICKET_REMOVE_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Ungültige User-ID. Bitte gib eine numerische Discord-ID ein (17–20 Stellen).');
    }

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');

    try {
      await removeUserFromTicket(interaction.guild, channelId, userId, interaction.member);
      await interaction.reply({
        embeds: [createSuccessEmbed(`<@${userId}> wurde aus dem Ticket entfernt.`)],
        ephemeral: true,
      });
    } catch {
      await replyError(interaction, 'Benutzer konnte nicht entfernt werden.');
    }
  },
};
