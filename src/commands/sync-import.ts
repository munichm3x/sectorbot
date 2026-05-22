import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types';
import { runInitialImport } from '../services/discordSync/import';
import { client } from '../client';
import { logger } from '../utils/logger';

const syncImportCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sync-import')
    .setDescription('Importiert bestehende Discord-Inhalte (Regeln, Changelog, Events) ins Dashboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur in Servern verfügbar.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    try {
      const report = await runInitialImport(client, interaction.guildId, `discord:${interaction.user.id}`);
      const lines = [
        '**Initial Import abgeschlossen**',
        '',
        `**Regeln:** ${report.rules.imported} importiert, ${report.rules.skipped} übersprungen${report.rules.note ? ` — ${report.rules.note}` : ''}`,
        `**Changelog:** ${report.changelog.imported} importiert, ${report.changelog.skipped} übersprungen${report.changelog.note ? ` — ${report.changelog.note}` : ''}`,
        `**Events:** ${report.events.imported} importiert, ${report.events.skipped} übersprungen${report.events.note ? ` — ${report.events.note}` : ''}`,
      ];
      if (report.errors.length > 0) {
        lines.push('', `**Fehler:** ${report.errors.slice(0, 5).join('; ')}`);
      }
      await interaction.editReply(lines.join('\n').slice(0, 1900));
    } catch (err) {
      logger.error('[sync-import] command error:', err);
      await interaction.editReply('Import fehlgeschlagen. Siehe Bot-Logs.');
    }
  },
};

export default syncImportCommand;
export { syncImportCommand };
