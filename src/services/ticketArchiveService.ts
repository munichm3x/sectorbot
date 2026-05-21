import { EmbedBuilder } from 'discord.js';
import type { Guild } from 'discord.js';
import { SECTOR_COLORS } from '../ui/brand';
import { getConfig } from './guildConfigService';
import { getTicketCategoryConfigs, enrichTicketClose, setTicketArchiveInfo } from '../db/index';
import { generateTicketSummary, type MessageEntry } from './ticketSummaryService';
import { logger } from '../utils/logger';
import type { Ticket } from '../types';

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Reads ticket messages, generates a summary, enriches the DB record,
 * and posts an archive card to the configured private archive channel.
 *
 * Safe to call before channel.delete() — does NOT close the ticket or delete the channel.
 * Never throws: all errors are caught and logged internally.
 */
export async function archiveTicket(
  guild:      Guild,
  channelId:  string,
  ticket:     Ticket | undefined,
  closedById: string,
): Promise<void> {
  try {
    await _archive(guild, channelId, ticket, closedById);
  } catch (err) {
    logger.error('[archiveTicket] Unerwarteter Fehler:', err);
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _archive(
  guild:      Guild,
  channelId:  string,
  ticket:     Ticket | undefined,
  closedById: string,
): Promise<void> {
  // ── 1. Fetch channel for message reading ───────────────────────────────────
  const rawChannel = await guild.channels.fetch(channelId).catch(() => null);
  const canRead    = rawChannel?.isTextBased() && !rawChannel.isDMBased();
  const channelName = rawChannel?.name ?? `ticket-${ticket?.category ?? channelId}`;

  // ── 2. Read messages (max 100, newest → oldest, reversed to chronological) ─
  let messages: MessageEntry[] = [];
  let attachmentCount = 0;
  let hasLinks        = false;

  if (canRead && rawChannel) {
    try {
      const fetched = await rawChannel.messages.fetch({ limit: 100 });
      const sorted  = [...fetched.values()].sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp,
      );

      messages = sorted.map(m => ({
        authorName:      m.author.username,
        authorId:        m.author.id,
        isBot:           m.author.bot,
        content:         m.content,
        attachmentCount: m.attachments.size,
        timestamp:       m.createdAt,
      }));

      attachmentCount = messages.reduce((n, m) => n + m.attachmentCount, 0);
      hasLinks        = messages.some(m => /https?:\/\//.test(m.content));
    } catch (err) {
      logger.warn(`[archiveTicket] Nachrichten konnten nicht gelesen werden (${channelId}):`, err);
    }
  }

  // ── 3. Resolve category label ──────────────────────────────────────────────
  const categories    = ticket ? getTicketCategoryConfigs(guild.id) : [];
  const cat           = categories.find(c => c.key === ticket?.category);
  const categoryLabel = cat
    ? `${cat.emoji} ${cat.label}`
    : (ticket?.category ?? 'Unbekannt');

  // ── 4. Generate summary ────────────────────────────────────────────────────
  let summaryText = 'Zusammenfassung konnte nicht erstellt werden.';
  let usedAI      = false;

  try {
    const result = await generateTicketSummary(ticket, messages, categoryLabel);
    summaryText  = result.text;
    usedAI       = result.usedAI;
  } catch (err) {
    logger.error('[archiveTicket] Zusammenfassungsfehler:', err);
  }

  // ── 5. Enrich DB record ────────────────────────────────────────────────────
  if (ticket) {
    try {
      enrichTicketClose(ticket.channel_id, closedById, messages.length, summaryText);
    } catch (err) {
      logger.error('[archiveTicket] DB-Anreicherung fehlgeschlagen:', err);
    }
  }

  // ── 6. Find archive channel ────────────────────────────────────────────────
  const config           = getConfig(guild.id);
  const archiveChannelId = config?.ticket_archive_channel_id;

  if (!archiveChannelId) {
    logger.info('[archiveTicket] Kein Archiv-Channel konfiguriert — Card wird nicht gepostet.');
    return;
  }

  const archiveRaw = await guild.channels.fetch(archiveChannelId).catch(() => null);
  if (!archiveRaw?.isTextBased() || archiveRaw.isDMBased()) {
    logger.warn(`[archiveTicket] Archiv-Channel ${archiveChannelId} nicht erreichbar oder kein Text-Channel.`);
    return;
  }

  // ── 7. Build and post archive card ────────────────────────────────────────
  // Collect unique staff IDs (non-bot, non-opener participants)
  const staffIds = [
    ...new Set(
      messages
        .filter(m => !m.isBot && m.authorId !== ticket?.opener_user_id)
        .map(m => m.authorId),
    ),
  ].slice(0, 5);

  const embed = buildArchiveCard({
    ticket,
    closedById,
    categoryLabel,
    channelName,
    messageCount: messages.length,
    summaryText,
    usedAI,
    attachmentCount,
    hasLinks,
    staffIds,
  });

  // ── 8. Fetch username snapshots (best-effort) ──────────────────────────────
  let usernameSnapshot:  string | null = null;
  let closedBySnapshot:  string | null = null;
  if (ticket) {
    try {
      const opener = await guild.members.fetch(ticket.opener_user_id).catch(() => null);
      usernameSnapshot = opener?.user.username ?? null;
    } catch { /* ignore */ }
  }
  try {
    const closer = await guild.members.fetch(closedById).catch(() => null);
    closedBySnapshot = closer?.user.username ?? null;
  } catch { /* ignore */ }

  // ── 9. Post archive card + save message reference ──────────────────────────
  try {
    const msg = await archiveRaw.send({ embeds: [embed] });
    logger.info(`[archiveTicket] Archive-Card gepostet für ${channelName} (#${ticket?.id ?? '?'})`);

    // Save archive reference + username snapshots for dashboard lookup
    if (ticket) {
      try {
        setTicketArchiveInfo(
          ticket.channel_id,
          msg.id,
          archiveChannelId,
          usernameSnapshot,
          closedBySnapshot,
        );
      } catch (err) {
        logger.error('[archiveTicket] setTicketArchiveInfo fehlgeschlagen:', err);
      }
    }
  } catch (err) {
    logger.error('[archiveTicket] Archive-Card konnte nicht gepostet werden:', err);
  }
}

// ─── Embed builder ─────────────────────────────────────────────────────────────

interface CardParams {
  ticket:         Ticket | undefined;
  closedById:     string;
  categoryLabel:  string;
  channelName:    string;
  messageCount:   number;
  summaryText:    string;
  usedAI:         boolean;
  attachmentCount: number;
  hasLinks:       boolean;
  staffIds:       string[];
}

function buildArchiveCard(p: CardParams): EmbedBuilder {
  const now       = Math.floor(Date.now() / 1000);
  const openedAt  = p.ticket?.created_at ?? now;
  const durationS = now - openedAt;

  // Clamp per-field to Discord's 1024-char limit
  const summary = p.summaryText.length > 1020
    ? p.summaryText.slice(0, 1020) + '…'
    : p.summaryText;

  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle('🎫 Ticket abgeschlossen')
    .setDescription('Ein Support-Ticket wurde abgeschlossen und intern dokumentiert.')
    // ── Row 1: identification ──
    .addFields(
      {
        name:   '🎫 Ticket-ID',
        value:  p.ticket ? `#${p.ticket.id}` : '—',
        inline: true,
      },
      {
        name:   '📁 Kategorie',
        value:  p.categoryLabel,
        inline: true,
      },
      {
        name:   '📊 Status',
        value:  '🔒 Geschlossen',
        inline: true,
      },
    )
    // ── Row 2: people ──
    .addFields(
      {
        name:   '👤 Erstellt von',
        value:  p.ticket ? `<@${p.ticket.opener_user_id}>` : '—',
        inline: true,
      },
      {
        name:   '🔒 Geschlossen von',
        value:  `<@${p.closedById}>`,
        inline: true,
      },
      {
        name:   '💬 Nachrichten',
        value:  String(p.messageCount),
        inline: true,
      },
    )
    // ── Row 3: timestamps ──
    .addFields(
      {
        name:   '🕐 Eröffnet',
        value:  `<t:${openedAt}:f>`,
        inline: true,
      },
      {
        name:   '🔒 Geschlossen',
        value:  `<t:${now}:f>`,
        inline: true,
      },
      {
        name:   '⏱ Laufzeit',
        value:  formatDuration(durationS),
        inline: true,
      },
    );

  // Staff (only if different from opener)
  if (p.staffIds.length > 0) {
    embed.addFields({
      name:   '👥 Beteiligte Teammitglieder',
      value:  p.staffIds.map(id => `<@${id}>`).join(' '),
      inline: false,
    });
  }

  // Attachments / links hint
  const hints: string[] = [];
  if (p.attachmentCount > 0) hints.push(`📎 ${p.attachmentCount} Anhang/Anhänge`);
  if (p.hasLinks)             hints.push('🔗 Links / Beweise vorhanden');
  if (hints.length > 0) {
    embed.addFields({ name: '🔎 Hinweise', value: hints.join(' · '), inline: false });
  }

  // Summary block — most important, always last before footer
  embed.addFields({
    name:   p.usedAI ? '🧾 Zusammenfassung *(KI)*' : '🧾 Zusammenfassung',
    value:  summary || '—',
    inline: false,
  });

  embed
    .setFooter({ text: `SECTOR 13 Ticketsystem • ${p.channelName}` })
    .setTimestamp();

  return embed;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
