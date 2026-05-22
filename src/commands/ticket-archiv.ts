import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
  canAccessArchive,
  buildHomeEmbed,
  buildHomeComponents,
} from '../features/ticketArchivDashboard';
import { getTicketStats } from '../db/index';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketArchivCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-archiv')
    .setDescription('Öffnet das Ticket-Archiv-Dashboard (nur für Admins / Support)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!canAccessArchive(interaction.member, interaction.guildId)) {
      return replyError(interaction, 'Du hast keine Berechtigung, das Ticket-Archiv einzusehen.');
    }

    const stats = getTicketStats(interaction.guildId);

    await interaction.reply({
      embeds:     [buildHomeEmbed(stats)],
      components: buildHomeComponents(interaction.guildId, interaction.user.id),
      ephemeral:  true,
    });
  },
};
