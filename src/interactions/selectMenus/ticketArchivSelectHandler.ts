/**
 * Select-menu handler for the Ticket-Archiv Dashboard.
 * Prefix: "ta"
 * Custom ID format: ta:select:{guildId}:{userId}:{page}
 * Value: ticket ID (string)
 *
 * Security: only the user who opened the dashboard session may interact with it.
 */

import type { StringSelectMenuInteraction } from 'discord.js';
import type { SelectMenuHandler } from '../../types';
import {
  canAccessArchive,
  buildDetailEmbed,
  buildDetailComponents,
} from '../../features/ticketArchivDashboard';
import { getClosedTicketById, getTicketCategoryConfigs } from '../../db/index';
import { replyError } from '../../utils/errors';

export const ticketArchivSelectHandler: SelectMenuHandler = {
  prefix: 'ta',

  async execute(interaction: StringSelectMenuInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    // payload = "select:{guildId}:{userId}:{page}"
    const parts   = payload.split(':');
    const guildId = parts[1];
    const userId  = parts[2];
    // parts[3] = page — not needed for navigation here

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

    await interaction.deferUpdate();

    const ticketId   = parseInt(interaction.values[0], 10);
    const ticket     = getClosedTicketById(ticketId, guildId);

    if (!ticket) {
      await interaction.editReply({ content: '❌ Ticket nicht gefunden.', embeds: [], components: [] });
      return;
    }

    const categories = getTicketCategoryConfigs(guildId);

    await interaction.editReply({
      embeds:     [buildDetailEmbed(ticket, categories)],
      components: buildDetailComponents(ticket, guildId, userId),
    });
  },
};
