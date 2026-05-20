import {
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { SECTOR_COLORS } from '../../ui/brand';
import { env } from '../../config/env';
import type { QueryResult } from './scumStatus.service';

const STATUS_TITLE   = '🩸 SECTOR 13 • SERVERSTATUS';
const STATUS_FOOTER  = 'SECTOR 13 • SCUM SERVER';
const RESTART_TIMES  = '00:00 & 12:00 Uhr';

export function buildStatusEmbed(
  result: QueryResult,
  host?: string,
  queryPort?: number,
): EmbedBuilder {
  const logoUrl   = env.SCUM_STATUS_LOGO_URL   || undefined;
  const bannerUrl = env.SCUM_STATUS_BANNER_URL || undefined;
  const addrLine  = host && queryPort ? `\`${host}:${queryPort}\`` : null;

  // ─── Base embed (shared) ──────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setTitle(STATUS_TITLE)
    .setFooter({ text: STATUS_FOOTER, ...(logoUrl ? { iconURL: logoUrl } : {}) })
    .setTimestamp();

  if (bannerUrl) embed.setImage(bannerUrl);

  // ─── OFFLINE ──────────────────────────────────────────────────────────────
  if (!result.online) {
    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: '⚡ Status',   value: '🔴 **OFFLINE**', inline: true },
      { name: '👥 Spieler',  value: '— / —',           inline: true },
      { name: '🏓 Ping',     value: '—',               inline: true },
    ];
    if (addrLine) fields.push({ name: '🌐 Adresse',  value: addrLine,     inline: true });
    fields.push(  { name: '🔁 Neustart', value: RESTART_TIMES, inline: true });

    return embed
      .setColor(SECTOR_COLORS.DARK_RED)
      .addFields(fields);
  }

  // ─── ONLINE ───────────────────────────────────────────────────────────────
  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: '⚡ Status',   value: '🟢 **ONLINE**',                                inline: true },
    { name: '👥 Spieler',  value: `**${result.players}** / ${result.maxPlayers}`, inline: true },
    { name: '🏓 Ping',     value: `${result.ping} ms`,                            inline: true },
  ];
  if (addrLine) fields.push({ name: '🌐 Adresse',  value: addrLine,     inline: true });
  fields.push(  { name: '🔁 Neustart', value: RESTART_TIMES, inline: true });

  const embed2 = embed
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .addFields(fields);

  if (result.serverName) embed2.setDescription(`\`${result.serverName}\``);

  return embed2;
}

export function buildScumConfigModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:config')
    .setTitle('Server konfigurieren')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('host')
          .setLabel('Server-IP oder Domain')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 123.456.789.0'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query_port')
          .setLabel('Query-Port')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Standard: 27015'),
      ),
    );
}

export function buildScumIntervalModal(currentSecs: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:interval')
    .setTitle('Aktualisierungsintervall')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('interval_secs')
          .setLabel('Intervall in Sekunden (Minimum: 30)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 60')
          .setValue(String(currentSecs)),
      ),
    );
}
