import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { addUserToTicket } from '../../services/ticketService';
import { createSuccessEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketAddModalHandler: ModalHandler = {
  prefix: IDS.TICKET_ADD_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Ungültige User-ID. Bitte gib eine numerische Discord-ID ein (17–20 Stellen).');
    }

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');

    try {
      await addUserToTicket(interaction.guild, channelId, userId, interaction.member);
      await interaction.reply({
        embeds: [createSuccessEmbed(`<@${userId}> wurde zum Ticket hinzugefügt.`)],
        ephemeral: true,
      });
    } catch {
      await replyError(interaction, 'Benutzer konnte nicht hinzugefügt werden. Bitte überprüfe die ID.');
    }
  },
};
