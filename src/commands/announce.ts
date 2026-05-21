import {
  SlashCommandBuilder, PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Command } from '../types';
import { createPublicAnnouncement } from '../db/index';
import { pushAnnouncementToDiscord } from '../services/discordSync';
import { client } from '../client';
import { insertAuditLog } from '../analytics/analytics.db';
import { logger } from '../utils/logger';

const VALID_TYPES = ['info', 'maintenance', 'warning', 'event', 'whitelist', 'rules'];

const announceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Öffentlichen Hinweis erstellen (erscheint im Dashboard + Announcement-Channel).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption(o => o
      .setName('typ')
      .setDescription('Hinweis-Typ')
      .setRequired(true)
      .addChoices(
        { name: 'Info',       value: 'info' },
        { name: 'Wartung',    value: 'maintenance' },
        { name: 'Warnung',    value: 'warning' },
        { name: 'Event',      value: 'event' },
        { name: 'Whitelist',  value: 'whitelist' },
        { name: 'Regeländerung', value: 'rules' },
      ))
    .addStringOption(o => o.setName('titel').setDescription('Kurzer Titel').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('text').setDescription('Inhalt').setRequired(true).setMaxLength(2000))
    .addIntegerOption(o => o.setName('dauer_stunden').setDescription('Wie lange aktiv (Stunden, leer = unbefristet)').setMinValue(1).setMaxValue(720))
    .addIntegerOption(o => o.setName('prioritaet').setDescription('Priorität (0–100, höher = oben)').setMinValue(0).setMaxValue(100))
    .addBooleanOption(o => o.setName('banner').setDescription('Als Banner im Dashboard pinnen?')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur in Servern verfügbar.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString('typ', true);
    if (!VALID_TYPES.includes(type)) {
      await interaction.editReply('Ungültiger Hinweis-Typ.');
      return;
    }
    const title    = interaction.options.getString('titel', true);
    const body     = interaction.options.getString('text', true);
    const hours    = interaction.options.getInteger('dauer_stunden') ?? null;
    const priority = interaction.options.getInteger('prioritaet') ?? 0;
    const banner   = interaction.options.getBoolean('banner') ?? false;

    const now = Math.floor(Date.now() / 1000);
    const endsAt = hours ? now + hours * 3600 : null;

    try {
      const created = createPublicAnnouncement({
        guild_id: interaction.guildId,
        title,
        body,
        announcement_type: type,
        priority,
        starts_at: now,
        ends_at: endsAt,
        show_as_banner: banner ? 1 : 0,
        active: 1,
        public_visible: 1,
        created_by: `discord:${interaction.user.id}`,
      });

      insertAuditLog({
        guildId: interaction.guildId,
        adminUserId: interaction.user.id,
        action: 'announce.create.discord',
        targetType: 'announcement',
        targetId: String(created.id),
        newValue: { title, type, priority, hours, banner },
        success: true,
      });

      // Async push to Discord (announcement-channel embed)
      pushAnnouncementToDiscord(client, created.id).catch(err =>
        logger.error('[sync] announce push failed:', err)
      );

      const lines = [
        `✅ **Hinweis erstellt** — ID ${created.id}`,
        `**Typ:** ${type} · **Priorität:** ${priority}${banner ? ' · 📌 Banner' : ''}`,
        `**Titel:** ${title}`,
        endsAt ? `**Aktiv bis:** <t:${endsAt}:R>` : '**Aktiv:** unbefristet',
        '',
        'Sichtbar im Public Dashboard. Wenn ein Announcement-Channel in den Settings konfiguriert ist, wird der Embed dort automatisch gepostet.',
      ];
      await interaction.editReply(lines.join('\n').slice(0, 1900));
    } catch (err) {
      logger.error('[announce] command error:', err);
      await interaction.editReply('Hinweis konnte nicht erstellt werden. Siehe Bot-Logs.');
    }
  },
};

export default announceCommand;
export { announceCommand };
