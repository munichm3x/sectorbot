import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getConfig, getSupportRoles, getAllCategories } from '../services/guildConfigService';
import { createWizardStep0Embed, buildWizardStep0Components } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Bot-Konfiguration öffnen'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const config       = getConfig(interaction.guildId);
    const supportRoles = getSupportRoles(interaction.guildId);
    const categories   = getAllCategories(interaction.guildId);

    await interaction.reply({
      ephemeral: true,
      embeds: [createWizardStep0Embed(config, supportRoles, categories)],
      components: buildWizardStep0Components(),
    });
  },
};
