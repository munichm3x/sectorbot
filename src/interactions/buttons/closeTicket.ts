import type { ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { createCloseConfirmEmbed } from '../../services/embedService';
import { makeId, IDS } from '../../utils/ids';
import { replyError } from '../../utils/errors';
import type { ButtonHandler } from '../../types';

export const ticketCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CLOSE,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CONFIRM_CLOSE, channelId))
        .setLabel('Schließen bestätigen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CANCEL_CLOSE, channelId))
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [createCloseConfirmEmbed()],
      components: [row],
      ephemeral: true,
    });
  },
};
