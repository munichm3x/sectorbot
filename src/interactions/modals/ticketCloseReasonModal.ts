import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { closeTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketCloseReasonModalHandler: ModalHandler = {
  prefix: IDS.TICKET_CLOSE_REASON_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const reason = interaction.fields.getTextInputValue('close_reason');
    await interaction.deferReply({ ephemeral: true });

    try {
      await closeTicket(interaction.guild, channelId, interaction.member, reason);
      await interaction.editReply({ content: '✅ Ticket wurde geschlossen.' }).catch(() => void 0);
    } catch (err) {
      await interaction.editReply({ content: `❌ Fehler: ${err instanceof Error ? err.message : String(err)}` }).catch(() => void 0);
    }
  },
};
