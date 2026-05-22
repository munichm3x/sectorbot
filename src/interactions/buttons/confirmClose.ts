import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  type ButtonInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
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

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_CLOSE_REASON_MODAL, channelId))
      .setTitle('Ticket schließen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Schließgrund')
            .setPlaceholder('Warum wird dieses Ticket geschlossen?')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
