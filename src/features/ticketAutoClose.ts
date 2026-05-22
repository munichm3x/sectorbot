// src/features/ticketAutoClose.ts
import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { SECTOR_COLORS } from '../ui/brand';
import {
  findTicketByChannel, closeTicket,
  getAllOpenTickets, touchTicketActivity,
  setTicketCloseReason,
} from '../db/index';
import { logEvent } from '../services/logService';
import { archiveTicket } from '../services/ticketArchiveService';
import { logger } from '../utils/logger';

const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 Stunden
const timers = new Map<string, ReturnType<typeof setTimeout>>();

let _client: Client;

// ── Öffentliche API ────────────────────────────────────────────────────────────

export function startAutoCloseTimer(channelId: string, delayMs = TIMEOUT_MS): void {
  clearAutoCloseTimer(channelId);
  timers.set(channelId, setTimeout(() => void fireAutoClose(channelId), delayMs));
}

export function clearAutoCloseTimer(channelId: string): void {
  const t = timers.get(channelId);
  if (t) { clearTimeout(t); timers.delete(channelId); }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

export function setupTicketAutoClose(client: Client): void {
  _client = client;

  // Beim Start: Timer für alle offenen Tickets wiederherstellen
  client.once('ready', () => {
    const openTickets = getAllOpenTickets();
    const now = Math.floor(Date.now() / 1000);
    let started = 0;
    let expired = 0;

    for (const ticket of openTickets) {
      const lastActivity = ticket.last_activity_at ?? ticket.created_at;
      const remainingSecs = (lastActivity + TIMEOUT_MS / 1000) - now;

      if (remainingSecs <= 0) {
        // Bereits abgelaufen → sofort schließen
        void fireAutoClose(ticket.channel_id);
        expired++;
      } else {
        startAutoCloseTimer(ticket.channel_id, remainingSecs * 1000);
        started++;
      }
    }

    logger.info(`[autoClose] ${started} Timer gestartet, ${expired} abgelaufene Tickets werden geschlossen.`);
  });

  // Jede Nachricht in einem Ticket-Channel → Timer zurücksetzen
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;

    const ticket = findTicketByChannel(message.channelId);
    if (!ticket || ticket.status !== 'open') return;

    touchTicketActivity(message.channelId);
    startAutoCloseTimer(message.channelId);
  });

  // Channel gelöscht (manuelles Schließen) → Timer abbrechen
  client.on('channelDelete', (channel) => {
    clearAutoCloseTimer(channel.id);
  });
}

// ── Auto-Close Aktion ──────────────────────────────────────────────────────────

async function fireAutoClose(channelId: string): Promise<void> {
  timers.delete(channelId);

  const ticket = findTicketByChannel(channelId);
  if (!ticket || ticket.status !== 'open') return;

  try {
    const guild = await _client.guilds.fetch(ticket.guild_id).catch(() => null);
    if (!guild) return;

    const rawChannel = await guild.channels.fetch(channelId).catch(() => null);

    // Abschluss-Nachricht senden
    if (rawChannel?.isTextBased() && !rawChannel.isDMBased()) {
      const embed = new EmbedBuilder()
        .setColor(SECTOR_COLORS.BLOOD_RED)
        .setTitle('🔒 Ticket automatisch geschlossen')
        .setDescription(
          'Dieses Ticket wurde automatisch geschlossen, da **24 Stunden** keine Aktivität festgestellt wurde.\n' +
          'Falls du noch Hilfe benötigst, öffne bitte ein neues Ticket.',
        )
        .setTimestamp();

      await rawChannel.send({ embeds: [embed] }).catch(() => void 0);
    }

    // Archive: read messages, generate AI summary, post to archive channel
    // Must run BEFORE closeTicket() and channel.delete() so messages are still readable
    // The bot's closing embed above is already in the channel — it will be filtered (isBot=true)
    await archiveTicket(guild, channelId, ticket, _client.user?.id ?? 'auto-close');

    // DB schließen
    setTicketCloseReason(channelId, 'Auto-close: Keine Aktivität (24 Stunden)');
    closeTicket(channelId);

    // Log
    await logEvent(guild, 'Ticket automatisch geschlossen', [
      { name: 'Kanal',      value: `ticket-${ticket.category}`,     inline: true },
      { name: 'Grund',      value: 'Keine Aktivität (24 Stunden)',  inline: true },
      { name: 'Ersteller',  value: `<@${ticket.opener_user_id}>`,   inline: true },
    ]);

    // Kurz warten damit die Nachricht sichtbar ist, dann Channel löschen
    await new Promise<void>(r => setTimeout(r, 5_000));
    await rawChannel?.delete('Auto-Close: keine Aktivität (24h)').catch(() => void 0);

    logger.info(`[autoClose] Ticket ${channelId} (${ticket.category}) automatisch geschlossen.`);
  } catch (err) {
    logger.error(`[autoClose] Fehler beim Schließen von Ticket ${channelId}: ${err}`);
  }
}
