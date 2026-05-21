import {
  SlashCommandBuilder, PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Command } from '../types';
import { upsertWipeInfo, getWipeInfo } from '../db/index';
import { pushServerInfoToDiscord } from '../services/discordSync';
import { client } from '../client';
import { insertAuditLog } from '../analytics/analytics.db';
import { logger } from '../utils/logger';

const VALID_TYPES = ['full', 'partial', 'economy', 'character'];
const TYPE_LABELS: Record<string, string> = {
  full: 'Full Wipe', partial: 'Partial Wipe', economy: 'Economy Wipe', character: 'Character Wipe',
};

function parseDate(input: string | null): number | null {
  if (!input) return null;
  // Accept ISO (2026-05-21T14:00), date-only (2026-05-21), or epoch seconds
  if (/^\d{10}$/.test(input)) return Number(input);
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 1000) : null;
}

const wipeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('wipe')
    .setDescription('Wipe-/Season-Info setzen (erscheint im Public Dashboard + Server-Info-Embed).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(s => s.setName('show').setDescription('Aktuelle Wipe-Info anzeigen'))
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Wipe-Info aktualisieren')
      .addIntegerOption(o => o.setName('season').setDescription('Season-Nummer').setMinValue(1))
      .addStringOption(o => o.setName('season_name').setDescription('Season-Name (z.B. "Hardcore Survival")').setMaxLength(100))
      .addStringOption(o => o.setName('letzter_wipe').setDescription('Letzter Wipe (YYYY-MM-DD oder ISO)'))
      .addStringOption(o => o.setName('letzter_typ').setDescription('Letzter Wipe-Typ').addChoices(
        { name: 'Full Wipe', value: 'full' },
        { name: 'Partial Wipe', value: 'partial' },
        { name: 'Economy Wipe', value: 'economy' },
        { name: 'Character Wipe', value: 'character' },
      ))
      .addStringOption(o => o.setName('naechster_wipe').setDescription('Nächster geplanter Wipe (YYYY-MM-DD oder ISO)'))
      .addStringOption(o => o.setName('naechster_typ').setDescription('Nächster Wipe-Typ').addChoices(
        { name: 'Full Wipe', value: 'full' },
        { name: 'Partial Wipe', value: 'partial' },
        { name: 'Economy Wipe', value: 'economy' },
        { name: 'Character Wipe', value: 'character' },
      ))
      .addStringOption(o => o.setName('notizen').setDescription('Öffentliche Notiz (z.B. „Char & Inventar reset")').setMaxLength(1000))
      .addBooleanOption(o => o.setName('oeffentlich').setDescription('Im Public Dashboard anzeigen?'))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur in Servern verfügbar.', ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      await interaction.deferReply({ ephemeral: true });
      const w = getWipeInfo(interaction.guildId);
      if (!w) {
        await interaction.editReply('Noch keine Wipe-Info gesetzt. Nutze `/wipe set` zum Anlegen.');
        return;
      }
      const lines = [
        '**Aktuelle Wipe-Info:**',
        w.current_season ? `**Season:** ${w.current_season}${w.season_name ? ` — ${w.season_name}` : ''}` : null,
        w.last_wipe_at ? `**Letzter Wipe:** <t:${w.last_wipe_at}:F>${w.last_wipe_type ? ` (${TYPE_LABELS[w.last_wipe_type] ?? w.last_wipe_type})` : ''}` : null,
        w.next_wipe_at ? `**Nächster Wipe:** <t:${w.next_wipe_at}:F>${w.next_wipe_type ? ` (${TYPE_LABELS[w.next_wipe_type] ?? w.next_wipe_type})` : ''}` : null,
        w.notes ? `**Notizen:** ${w.notes}` : null,
        `**Public sichtbar:** ${w.public_visible ? 'Ja' : 'Nein'}`,
      ].filter(Boolean);
      await interaction.editReply(lines.join('\n').slice(0, 1900));
      return;
    }

    // set
    await interaction.deferReply({ ephemeral: true });

    const season       = interaction.options.getInteger('season') ?? null;
    const seasonName   = interaction.options.getString('season_name');
    const lastWipeStr  = interaction.options.getString('letzter_wipe');
    const lastWipeType = interaction.options.getString('letzter_typ');
    const nextWipeStr  = interaction.options.getString('naechster_wipe');
    const nextWipeType = interaction.options.getString('naechster_typ');
    const notes        = interaction.options.getString('notizen');
    const publicFlag   = interaction.options.getBoolean('oeffentlich');

    const lastWipeAt = parseDate(lastWipeStr);
    if (lastWipeStr && !lastWipeAt) {
      await interaction.editReply('Ungültiges Datum für „letzter_wipe". Format: YYYY-MM-DD oder ISO-Timestamp.');
      return;
    }
    const nextWipeAt = parseDate(nextWipeStr);
    if (nextWipeStr && !nextWipeAt) {
      await interaction.editReply('Ungültiges Datum für „naechster_wipe".');
      return;
    }
    if (lastWipeType && !VALID_TYPES.includes(lastWipeType)) {
      await interaction.editReply('Ungültiger letzter Wipe-Typ.');
      return;
    }
    if (nextWipeType && !VALID_TYPES.includes(nextWipeType)) {
      await interaction.editReply('Ungültiger nächster Wipe-Typ.');
      return;
    }

    try {
      const existing = getWipeInfo(interaction.guildId);
      const merged = {
        guildId:        interaction.guildId,
        currentSeason:  season              ?? existing?.current_season ?? null,
        seasonName:     seasonName          ?? existing?.season_name    ?? null,
        lastWipeAt:     lastWipeAt          ?? existing?.last_wipe_at   ?? null,
        lastWipeType:   lastWipeType        ?? existing?.last_wipe_type ?? null,
        nextWipeAt:     nextWipeAt          ?? existing?.next_wipe_at   ?? null,
        nextWipeType:   nextWipeType        ?? existing?.next_wipe_type ?? null,
        notes:          notes               ?? existing?.notes          ?? null,
        publicVisible:  publicFlag !== null && publicFlag !== undefined
          ? (publicFlag ? 1 : 0)
          : (existing?.public_visible ?? 1),
        updatedBy:      `discord:${interaction.user.id}`,
      };

      const result = upsertWipeInfo(merged);

      insertAuditLog({
        guildId: interaction.guildId,
        adminUserId: interaction.user.id,
        action: 'wipe.upsert.discord',
        targetType: 'wipe-info',
        targetId: interaction.guildId,
        oldValue: existing ?? null,
        newValue: result,
        success: true,
      });

      // Async push to Server-Info embed (wipe is integrated)
      pushServerInfoToDiscord(client, interaction.guildId).catch(err =>
        logger.error('[sync] wipe → server-info push failed:', err)
      );

      const lines = [
        '✅ **Wipe-Info aktualisiert**',
        merged.currentSeason ? `**Season:** ${merged.currentSeason}${merged.seasonName ? ` — ${merged.seasonName}` : ''}` : null,
        merged.lastWipeAt    ? `**Letzter Wipe:** <t:${merged.lastWipeAt}:F>${merged.lastWipeType ? ` (${TYPE_LABELS[merged.lastWipeType] ?? merged.lastWipeType})` : ''}` : null,
        merged.nextWipeAt    ? `**Nächster Wipe:** <t:${merged.nextWipeAt}:F>${merged.nextWipeType ? ` (${TYPE_LABELS[merged.nextWipeType] ?? merged.nextWipeType})` : ''}` : null,
        merged.notes         ? `**Notizen:** ${merged.notes}` : null,
        `**Public sichtbar:** ${merged.publicVisible ? 'Ja' : 'Nein'}`,
      ].filter(Boolean);
      await interaction.editReply(lines.join('\n').slice(0, 1900));
    } catch (err) {
      logger.error('[wipe] command error:', err);
      await interaction.editReply('Wipe-Info konnte nicht aktualisiert werden. Siehe Bot-Logs.');
    }
  },
};

export default wipeCommand;
export { wipeCommand };
