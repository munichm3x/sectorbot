// src/commands/streamer.ts
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import { getStreamerConfig, upsertStreamerConfig, countStreamers } from '../features/streamer/streamer.db';
import { buildDashboardEmbed, buildDashboardComponents, buildWizardStep1 } from '../features/streamer/streamer.embeds';
import type { Command } from '../types';

export const streamerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('streamer')
    .setDescription('Streamer-Live-Announcement-System verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst **Server verwalten**-Berechtigung.');
    }

    const { guild, user } = interaction;
    const guildId = guild.id;
    const userId  = user.id;

    let config = getStreamerConfig(guildId);
    if (!config) {
      config = upsertStreamerConfig(guildId, {});
    }

    if (!config.setup_completed) {
      const step1 = buildWizardStep1(guildId, userId);
      return interaction.reply({ ...step1, ephemeral: true });
    }

    const counts = countStreamers(guildId);
    const embed  = buildDashboardEmbed(config, counts, guild.name);
    const rows   = buildDashboardComponents(config, guildId, userId);
    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  },
};
