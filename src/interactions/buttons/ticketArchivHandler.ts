/**
 * Button handler for the Ticket-Archiv Dashboard.
 * Prefix: "ta"
 * Custom ID format: ta:{action}:{guildId}:{userId}[:{extra}]
 *
 * Security: only the user who opened the dashboard session may interact with it.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonHandler } from '../../types';
import {
  canAccessArchive,
  buildHomeEmbed,
  buildHomeComponents,
  buildListEmbed,
  buildListComponents,
  buildDetailEmbed,
  buildDetailComponents,
  buildSearchModal,
  TA_PAGE_SIZE,
} from '../../features/ticketArchivDashboard';
import {
  getTicketStats,
  getRecentClosedTickets,
  countClosedTickets,
  getClosedTicketById,
  getTicketCategoryConfigs,
} from '../../db/index';
import { replyError } from '../../utils/errors';

export const ticketArchivButtonHandler: ButtonHandler = {
  prefix: 'ta',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    // No-op buttons (disabled placeholders)
    if (payload === '_noop' || payload === '_noop_arch') {
      return interaction.deferUpdate();
    }

    // Parse: {action}:{guildId}:{userId}[:{extra}]
    const parts    = payload.split(':');
    const action   = parts[0];
    const guildId  = parts[1];
    const userId   = parts[2];
    const extra    = parts[3]; // optional (page number etc.)

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

    // ── Dispatch action ───────────────────────────────────────────────────────
    switch (action) {

      case 'home': {
        await interaction.deferUpdate();
        const stats = getTicketStats(guildId);
        await interaction.editReply({
          embeds:     [buildHomeEmbed(stats)],
          components: buildHomeComponents(guildId, userId),
        });
        break;
      }

      case 'list': {
        await interaction.deferUpdate();
        const page       = Math.max(0, parseInt(extra ?? '0', 10) || 0);
        const total      = countClosedTickets(guildId);
        const totalPages = Math.max(1, Math.ceil(total / TA_PAGE_SIZE));
        const safePage   = Math.min(page, totalPages - 1);
        const tickets    = getRecentClosedTickets(guildId, TA_PAGE_SIZE, safePage * TA_PAGE_SIZE);
        const categories = getTicketCategoryConfigs(guildId);

        await interaction.editReply({
          embeds:     [buildListEmbed(safePage, totalPages, total)],
          components: buildListComponents(tickets, categories, guildId, userId, safePage, totalPages),
        });
        break;
      }

      case 'search': {
        // Open search modal — cannot deferUpdate before showModal
        const modal = buildSearchModal(guildId, userId);
        await interaction.showModal(modal);
        break;
      }

      case 'detail': {
        // extra = ticket ID
        await interaction.deferUpdate();
        const ticketId = parseInt(extra ?? '0', 10);
        const ticket   = getClosedTicketById(ticketId, guildId);
        if (!ticket) {
          await interaction.editReply({ content: '❌ Ticket nicht gefunden.', embeds: [], components: [] });
          break;
        }
        const categories = getTicketCategoryConfigs(guildId);
        await interaction.editReply({
          embeds:     [buildDetailEmbed(ticket, categories)],
          components: buildDetailComponents(ticket, guildId, userId),
        });
        break;
      }

      case 'close': {
        await interaction.update({ content: '✅ Dashboard geschlossen.', embeds: [], components: [] });
        break;
      }

      default: {
        await interaction.deferUpdate();
        break;
      }
    }
  },
};
