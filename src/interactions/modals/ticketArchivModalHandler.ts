/**
 * Modal handler for the Ticket-Archiv Dashboard — search modal.
 * Prefix: "ta"
 * Custom ID format: ta:search_modal:{guildId}:{userId}
 *
 * Security: only the user who opened the dashboard session may interact with it.
 */

import type { ModalSubmitInteraction } from 'discord.js';
import type { ModalHandler } from '../../types';
import {
  canAccessArchive,
  buildListEmbed,
  buildListComponents,
  TA_PAGE_SIZE,
} from '../../features/ticketArchivDashboard';
import {
  searchClosedTickets,
  countSearchClosedTickets,
  getTicketCategoryConfigs,
} from '../../db/index';
import { replyError } from '../../utils/errors';

export const ticketArchivModalHandler: ModalHandler = {
  prefix: 'ta',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    // payload = "search_modal:{guildId}:{userId}"
    const parts   = payload.split(':');
    const guildId = parts[1];
    const userId  = parts[2];

    // ── Session ownership check ──────────────────────────────────────────────
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: '❌ Diese Dashboard-Session gehört dir nicht.',
        ephemeral: true,
      });
    }

    // ── Permission check ─────────────────────────────────────────────────────
    if (!canAccessArchive(interaction.member, guildId)) {
      return replyError(interaction, 'Du hast keine Berechtigung, das Ticket-Archiv einzusehen.');
    }

    const query = interaction.fields.getTextInputValue('query').trim();
    if (!query) {
      return interaction.reply({ content: '❌ Kein Suchbegriff eingegeben.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const total      = countSearchClosedTickets(guildId, query);
    const totalPages = Math.max(1, Math.ceil(total / TA_PAGE_SIZE));
    const tickets    = searchClosedTickets(guildId, query, TA_PAGE_SIZE, 0);
    const categories = getTicketCategoryConfigs(guildId);

    await interaction.editReply({
      embeds:     [buildListEmbed(0, totalPages, total, query)],
      components: buildListComponents(tickets, categories, guildId, userId, 0, totalPages),
    });
  },
};
