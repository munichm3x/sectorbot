import type { ButtonInteraction } from 'discord.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { makeId, IDS } from '../../utils/ids';
import { replyError } from '../../utils/errors';
import type { ButtonHandler } from '../../types';

export const ticketAddPromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_ADD_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_ADD_MODAL, channelId))
      .setTitle('Benutzer hinzufügen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('Discord User-ID')
            .setPlaceholder('z.B. 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  },
};
