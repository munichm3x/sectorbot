import { SlashCommandBuilder, TextChannel, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';

export const clearCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Löscht Nachrichten in diesem Channel')
    .addIntegerOption(opt =>
      opt
        .setName('anzahl')
        .setDescription('Anzahl der zu löschenden Nachrichten (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ ephemeral: true, content: 'Dieser Befehl kann nur in einem Server verwendet werden.' });
      return;
    }

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst die Berechtigung "Server verwalten" für diesen Befehl.');
    }

    const amount = interaction.options.getInteger('anzahl', true);
    const channel = interaction.channel;

    if (!(channel instanceof TextChannel)) {
      return replyError(interaction, 'Dieser Befehl funktioniert nur in Textkanälen.');
    }

    await interaction.deferReply({ ephemeral: true });

    const deleted = await channel.bulkDelete(amount, true);

    await interaction.editReply({ content: `${deleted.size} Nachricht(en) gelöscht.` });
  },
};
