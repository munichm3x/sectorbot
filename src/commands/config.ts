import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getConfig, getSupportRoles, getAllCategories } from '../services/guildConfigService';
import { createAdminPanelEmbed } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Aktuelle Konfiguration anzeigen'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const config = getConfig(interaction.guildId);

    if (!config) {
      return replyError(interaction, 'Keine Konfiguration vorhanden. Führe `/setup` aus.');
    }

    const supportRoles = getSupportRoles(interaction.guildId);
    const categories   = getAllCategories(interaction.guildId);

    await interaction.reply({
      ephemeral: true,
      embeds: [createAdminPanelEmbed(config, supportRoles, categories, interaction.guild)],
    });
  },
};
