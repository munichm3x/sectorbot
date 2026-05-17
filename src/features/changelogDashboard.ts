import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Guild,
} from 'discord.js';
import { BRAND } from '../ui/brand';
import { getChangelogConfig, upsertChangelogConfig } from '../db/index';
import { logger } from '../utils/logger';
import type { ChangelogConfig, ChangelogDraft } from '../types';

// ─── Draft store ───────────────────────────────────────────────────────────────

const DRAFT_TTL_MS = 30 * 60 * 1000;

const drafts = new Map<string, ChangelogDraft>();

export function draftKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getDraft(key: string): ChangelogDraft | undefined {
  const draft = drafts.get(key);
  if (!draft) return undefined;
  if (Date.now() - draft.createdAt > DRAFT_TTL_MS) {
    drafts.delete(key);
    return undefined;
  }
  return draft;
}

export function setDraft(key: string, draft: ChangelogDraft): void {
  drafts.set(key, draft);
}

export function deleteDraft(key: string): void {
  drafts.delete(key);
}

// ─── Formatters ────────────────────────────────────────────────────────────────

export function formatChangelogEntries(text: string): string | null {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(l => l.length > 0)
    .map(l => `• ${l}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

export function splitFieldValue(value: string, maxLength = 1024): string[] {
  if (value.length <= maxLength) return [value];
  const lines = value.split('\n');
  const parts: string[] = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength) {
      if (current) parts.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ─── Embed builders ────────────────────────────────────────────────────────────

const CHANGELOG_COLOR = 0xE8880A;

interface BuildChangelogEmbedOptions {
  preview?:   boolean;
  createdBy?: string;
}

export function buildChangelogEmbed(
  draft: ChangelogDraft,
  options: BuildChangelogEmbedOptions = {},
): EmbedBuilder {
  const title = options.preview
    ? '🧾 SECTOR 13 CHANGELOG — VORSCHAU'
    : '🧾 SECTOR 13 CHANGELOG';

  let description = `**Version:** \`${draft.version}\``;
  if (draft.title.trim()) description += `\n**Titel:** ${draft.title.trim()}`;
  if (options.preview) {
    description += '\n\n⚠️ *Dies ist nur eine Vorschau. Noch nicht veröffentlicht.*';
  }

  const footerText = options.createdBy
    ? `${BRAND.NAME} • Erstellt von ${options.createdBy}`
    : BRAND.NAME;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(CHANGELOG_COLOR)
    .setFooter({ text: footerText })
    .setTimestamp();

  const categories: [string, string][] = [
    ['🟢 Hinzugefügt', draft.added],
    ['🟡 Geändert',    draft.changed],
    ['🔧 Behoben',     draft.fixed],
    ['🔴 Entfernt',    draft.removed],
    ['📌 Notizen',     draft.notes],
  ];

  for (const [label, raw] of categories) {
    const formatted = formatChangelogEntries(raw);
    if (!formatted) continue;
    const parts = splitFieldValue(formatted);
    embed.addFields({ name: label, value: parts[0], inline: false });
    for (let i = 1; i < parts.length; i++) {
      embed.addFields({ name: `${label} (Teil ${i + 1})`, value: parts[i], inline: false });
    }
  }

  return embed;
}

export function buildDashboardEmbed(config: ChangelogConfig): EmbedBuilder {
  const createCh = config.create_channel_id ? `<#${config.create_channel_id}>` : '*Nicht gesetzt*';
  const publicCh = config.public_channel_id ? `<#${config.public_channel_id}>` : '*Nicht gesetzt*';

  return new EmbedBuilder()
    .setTitle('🧾 Sector 13 Changelog Dashboard')
    .setDescription(
      'Erstelle professionelle, einheitliche Changelogs für den öffentlichen Update-Kanal.\n\n' +
      '**Anleitung:**\n' +
      '1. Klicke auf **Changelog erstellen**\n' +
      '2. Fülle die Kategorien aus\n' +
      '3. Prüfe die Vorschau\n' +
      '4. Veröffentliche den Changelog'
    )
    .setColor(CHANGELOG_COLOR)
    .addFields(
      { name: '📝 Erstellen-Kanal',             value: createCh, inline: true },
      { name: '📢 Öffentlicher Changelog-Kanal', value: publicCh, inline: true },
    )
    .setFooter({ text: BRAND.NAME })
    .setTimestamp();
}

export function buildDashboardComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('changelog:create')
        .setLabel('Changelog erstellen')
        .setEmoji('🧾')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('changelog:refresh')
        .setLabel('Dashboard aktualisieren')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function buildPreviewComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('changelog:add_extra')
        .setLabel('Entfernt/Notizen hinzufügen')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('changelog:publish')
        .setLabel('Veröffentlichen')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('changelog:cancel')
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ─── Modal builders ────────────────────────────────────────────────────────────

export function buildChangelogModal1(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('changelog:m1')
    .setTitle('Changelog erstellen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('version')
          .setLabel('Version')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 1.3.0'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titel (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('z.B. Großes Update'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('added')
          .setLabel('Hinzugefügt')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Neue Funktionen — eine pro Zeile'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('changed')
          .setLabel('Geändert')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Geänderte Funktionen — eine pro Zeile'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('fixed')
          .setLabel('Behoben')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Behobene Fehler — eine pro Zeile'),
      ),
    );
}

export function buildChangelogModal2(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('changelog:m2')
    .setTitle('Entfernt & Notizen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('removed')
          .setLabel('Entfernt')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Entfernte Funktionen — eine pro Zeile'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Notizen')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Allgemeine Hinweise — eine pro Zeile'),
      ),
    );
}

// ─── Dashboard management ──────────────────────────────────────────────────────

export async function ensureChangelogDashboard(guild: Guild): Promise<void> {
  const config = getChangelogConfig(guild.id);
  if (!config?.create_channel_id) return;

  const channel = await guild.channels.fetch(config.create_channel_id).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed      = buildDashboardEmbed(config);
  const components = buildDashboardComponents();

  let msgId = config.dashboard_msg_id ?? null;

  if (msgId) {
    try {
      const msg = await channel.messages.fetch(msgId);
      await msg.edit({ embeds: [embed], components });
      return;
    } catch {
      msgId = null;
    }
  }

  const msg = await channel.send({ embeds: [embed], components });
  upsertChangelogConfig(guild.id, { dashboard_msg_id: msg.id });
}

export function setupChangelogDashboard(client: Client): void {
  client.once('ready', async (c) => {
    for (const [, guild] of c.guilds.cache) {
      try {
        await ensureChangelogDashboard(guild);
      } catch (err) {
        logger.warn(`[changelog] Dashboard-Fehler für Guild ${guild.id}: ${err}`);
      }
    }
    logger.info('[changelog] Dashboard-Initialisierung abgeschlossen.');
  });
}
