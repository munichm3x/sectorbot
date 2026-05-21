/**
 * Ticket-Archiv Dashboard
 * Central module: embed builders, component builders, helpers.
 * All dashboard interactions use prefix "ta".
 *
 * Custom ID format:  ta:{action}:{guildId}:{userId}[:{extra}]
 * Actions:           home | list | search | detail | close
 * Select menu CID:   ta:select:{guildId}:{userId}:{page}
 * Modal CID:         ta:search_modal:{guildId}:{userId}
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { SECTOR_COLORS, BRAND } from '../ui/brand';
import { isAdmin, isSupport } from '../services/permissionService';
import type { Ticket, TicketCategoryConfig } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const TA_PAGE_SIZE = 8;   // tickets per page in list/search

// ─── Permission check ──────────────────────────────────────────────────────────

export function canAccessArchive(member: GuildMember, guildId: string): boolean {
  return isAdmin(member) || isSupport(member, guildId);
}

// ─── ID helpers ────────────────────────────────────────────────────────────────

export function taId(action: string, guildId: string, userId: string, extra?: string | number): string {
  return extra !== undefined
    ? `ta:${action}:${guildId}:${userId}:${extra}`
    : `ta:${action}:${guildId}:${userId}`;
}

// ─── Home embed ────────────────────────────────────────────────────────────────

export function buildHomeEmbed(stats: {
  total: number;
  thisWeek: number;
  thisMonth: number;
  topCategory: string | null;
  lastClosed: Ticket | undefined;
}): EmbedBuilder {
  const lastClosedAt = stats.lastClosed?.closed_at ?? stats.lastClosed?.created_at;

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle('🎛️ Ticket-Archiv Dashboard')
    .setDescription(
      'Interne Übersicht für geschlossene Support-Tickets.\n' +
      'Suche, filtere und öffne gespeicherte Ticket-Zusammenfassungen.',
    )
    .addFields(
      { name: '📊 Gesamt',        value: String(stats.total),                                      inline: true },
      { name: '📅 Diese Woche',   value: String(stats.thisWeek),                                   inline: true },
      { name: '📅 Diesen Monat',  value: String(stats.thisMonth),                                  inline: true },
      { name: '🏷️ Häufigste Kat.', value: stats.topCategory ?? '—',                               inline: true },
      { name: '🕐 Letztes Ticket', value: lastClosedAt ? `<t:${lastClosedAt}:R>` : '—',           inline: true },
      { name: '​', value: '​', inline: true }, // zero-width spacer
    )
    .setFooter({ text: `${BRAND.NAME} • Ticket-Archiv` })
    .setTimestamp();
}

export function buildHomeComponents(guildId: string, userId: string): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(taId('search', guildId, userId))
        .setLabel('Ticket suchen')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(taId('list', guildId, userId, 0))
        .setLabel('Alle Tickets')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(taId('home', guildId, userId))
        .setLabel('Aktualisieren')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(taId('close', guildId, userId))
        .setLabel('Schließen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

// ─── List embed ────────────────────────────────────────────────────────────────

export function buildListEmbed(
  page:       number,
  totalPages: number,
  total:      number,
  query?:     string,
): EmbedBuilder {
  const title = query
    ? `🔍 Suchergebnisse — "${query.slice(0, 40)}"`
    : '📋 Geschlossene Tickets';

  const desc = total === 0
    ? query
      ? 'Keine Tickets gefunden. Versuche einen anderen Suchbegriff.'
      : 'Es wurden noch keine Tickets geschlossen.'
    : `${total} Ticket${total === 1 ? '' : 's'} gefunden. Wähle eines aus dem Menü.`;

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.CHARCOAL)
    .setTitle(title)
    .setDescription(desc)
    .addFields(
      {
        name:   '​',
        value:  totalPages > 0 ? `Seite **${page + 1}** / ${totalPages}` : '​',
        inline: false,
      },
    )
    .setFooter({ text: `${BRAND.NAME} • Ticket-Archiv` })
    .setTimestamp();
}

export function buildListComponents(
  tickets:    Ticket[],
  categories: TicketCategoryConfig[],
  guildId:    string,
  userId:     string,
  page:       number,
  totalPages: number,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  // Select menu
  if (tickets.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ta:select:${guildId}:${userId}:${page}`)
      .setPlaceholder('Ticket auswählen...')
      .addOptions(
        tickets.map(t => buildTicketOption(t, categories)),
      );
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(menu) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    );
  }

  // Navigation buttons
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(taId('list', guildId, userId, Math.max(0, page - 1)))
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('ta:_noop')
      .setLabel(totalPages > 0 ? `${page + 1} / ${totalPages}` : '—')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(taId('list', guildId, userId, page + 1))
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(taId('search', guildId, userId))
      .setLabel('Suche')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(taId('home', guildId, userId))
      .setLabel('Home')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(navRow as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);

  return rows;
}

// ─── Detail embed ──────────────────────────────────────────────────────────────

export function buildDetailEmbed(
  ticket:     Ticket,
  categories: TicketCategoryConfig[],
): EmbedBuilder {
  const cat          = categories.find(c => c.key === ticket.category);
  const categoryLabel = cat ? `${cat.emoji} ${cat.label}` : ticket.category;
  const openedAt     = ticket.created_at;
  const closedAt     = ticket.closed_at ?? Math.floor(Date.now() / 1000);
  const duration     = formatDuration(closedAt - openedAt);

  // Display names
  const opener   = ticket.username_snapshot
    ? `**${ticket.username_snapshot}** (<@${ticket.opener_user_id}>)`
    : `<@${ticket.opener_user_id}>`;
  const closer   = ticket.closed_by
    ? ticket.closed_by_username_snapshot
      ? `**${ticket.closed_by_username_snapshot}** (<@${ticket.closed_by}>)`
      : `<@${ticket.closed_by}>`
    : '*(Auto-Close)*';

  // Summary (clamp to field limit)
  const rawSummary = ticket.summary ?? '*Keine Zusammenfassung gespeichert.*';
  const summary    = rawSummary.length > 1020
    ? rawSummary.slice(0, 1017) + '…'
    : rawSummary;

  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle(`🎫 Ticket #${ticket.id} — ${categoryLabel}`)
    .setDescription('Abgeschlossene Support-Anfrage — gespeicherte Zusammenfassung.')
    .addFields(
      { name: '🎫 Ticket-ID',      value: `#${ticket.id}`,       inline: true },
      { name: '📁 Kategorie',      value: categoryLabel,          inline: true },
      { name: '📊 Status',         value: '🔒 Geschlossen',       inline: true },
      { name: '👤 Erstellt von',   value: opener,                 inline: false },
      { name: '🔒 Geschlossen von', value: closer,               inline: true },
      { name: '💬 Nachrichten',    value: String(ticket.message_count ?? '—'), inline: true },
      { name: '🕐 Eröffnet',       value: `<t:${openedAt}:f>`,   inline: true },
      { name: '🔒 Geschlossen',    value: `<t:${closedAt}:f>`,   inline: true },
      { name: '⏱ Laufzeit',        value: duration,              inline: true },
      { name: '🧾 Zusammenfassung', value: summary,              inline: false },
    )
    .setFooter({ text: `${BRAND.NAME} • Ticket-Archiv` })
    .setTimestamp(closedAt * 1000);

  return embed;
}

export function buildDetailComponents(
  ticket:  Ticket,
  guildId: string,
  userId:  string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(taId('list', guildId, userId, 0))
      .setLabel('Zur Liste')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(taId('search', guildId, userId))
      .setLabel('Neue Suche')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
  ];

  // Archive jump button — Link style if we have the reference
  if (ticket.archive_message_id && ticket.archive_channel_id && guildId) {
    const url = `https://discord.com/channels/${guildId}/${ticket.archive_channel_id}/${ticket.archive_message_id}`;
    buttons.push(
      new ButtonBuilder()
        .setURL(url)
        .setLabel('Im Archiv öffnen')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Link),
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('ta:_noop_arch')
        .setLabel('Kein Archiv-Link')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(taId('close', guildId, userId))
      .setLabel('Schließen')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );

  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(...buttons) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

// ─── Search modal ──────────────────────────────────────────────────────────────

export function buildSearchModal(guildId: string, userId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ta:search_modal:${guildId}:${userId}`)
    .setTitle('Ticket suchen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query')
          .setLabel('Suchbegriff')
          .setPlaceholder('Ticket-ID, Discord-ID, Steam-ID, Username, Kategorie oder Stichwort')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildTicketOption(
  ticket:     Ticket,
  categories: TicketCategoryConfig[],
): StringSelectMenuOptionBuilder {
  const cat   = categories.find(c => c.key === ticket.category);
  const emoji = cat?.emoji ?? '🎫';
  const label = `#${ticket.id} · ${cat?.label ?? ticket.category}`.slice(0, 100);

  const username = ticket.username_snapshot ?? ticket.opener_user_id.slice(0, 10);
  const date     = ticket.closed_at
    ? new Date(ticket.closed_at * 1000).toLocaleDateString('de-DE')
    : '—';
  const desc = `${username} · ${date}`.slice(0, 100);

  return new StringSelectMenuOptionBuilder()
    .setLabel(label)
    .setDescription(desc)
    .setValue(String(ticket.id))
    .setEmoji(emoji);
}

function formatDuration(secs: number): string {
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return h > 0 ? `${d}T ${h}h` : `${d}T`;
}
