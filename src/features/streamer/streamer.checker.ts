// src/features/streamer/streamer.checker.ts
import type { Client } from 'discord.js';
import { logger } from '../../utils/logger';
import {
  getAllActiveStreamerConfigs, getStreamerConfig,
  getEnabledStreamers, getLiveState, upsertLiveState,
  setStreamerLastSuccessfulCheck, setStreamerLastError,
} from './streamer.db';
import { checkTwitchStream } from './streamer.twitch';
import { checkYouTubeStream } from './streamer.youtube';
import { buildAnnouncementEmbed, buildAnnouncementComponents } from './streamer.embeds';
import type { StreamerConfig, Streamer, LiveResult } from './streamer.types';

const MIN_INTERVAL_MS = 60_000;
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();
let _client: Client;

// ── Public API ────────────────────────────────────────────────────────────────

export function setupStreamerChecker(client: Client): void {
  _client = client;
  client.once('ready', async () => {
    const configs = getAllActiveStreamerConfigs();
    for (const config of configs) {
      startGuildInterval(client, config.guild_id);
    }
    logger.info(`[streamer] ${configs.length} Live-Checker gestartet.`);
  });
}

export function startGuildInterval(client: Client, guildId: string): void {
  _client = client;
  stopGuildInterval(guildId);

  const config = getStreamerConfig(guildId);
  if (!config?.enabled || !config.setup_completed) return;

  const ms = Math.max(config.check_interval_seconds * 1000, MIN_INTERVAL_MS);

  void runGuildCheck(guildId);
  activeIntervals.set(guildId, setInterval(() => void runGuildCheck(guildId), ms));
}

export function stopGuildInterval(guildId: string): void {
  const existing = activeIntervals.get(guildId);
  if (existing) { clearInterval(existing); activeIntervals.delete(guildId); }
}

// ── Check-Logik ───────────────────────────────────────────────────────────────

async function runGuildCheck(guildId: string): Promise<void> {
  try {
    const config = getStreamerConfig(guildId);
    if (!config?.enabled || !config.setup_completed || !config.streamer_role_id || !config.live_channel_id) {
      stopGuildInterval(guildId);
      return;
    }

    const guild = await _client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const streamers = getEnabledStreamers(guildId);

    for (const streamer of streamers) {
      try {
        const member = await guild.members.fetch(streamer.discord_user_id).catch(() => null);
        if (!member) continue;
        if (!member.roles.cache.has(config.streamer_role_id)) continue;

        if (config.twitch_client_id && config.twitch_client_secret && streamer.twitch_username) {
          const result = await checkTwitchStream(config, streamer.twitch_username);
          await handleLiveStateChange(config, streamer, 'twitch', result);
        }

        if (config.youtube_api_key && streamer.youtube_channel_id) {
          const result = await checkYouTubeStream(config.youtube_api_key, streamer.youtube_channel_id);
          await handleLiveStateChange(config, streamer, 'youtube', result);
        }
      } catch (streamerErr) {
        logger.warn(`[streamer] Fehler bei Streamer ${streamer.discord_user_id}: ${streamerErr}`);
      }
    }

    setStreamerLastSuccessfulCheck(guildId);
  } catch (err) {
    logger.error(`[streamer] Check-Fehler für Guild ${guildId}: ${err}`);
    setStreamerLastError(guildId, String(err));
  }
}

// ── State-Übergang + Announcement ─────────────────────────────────────────────

async function handleLiveStateChange(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
): Promise<void> {
  const { guild_id, discord_user_id } = streamer;
  const state   = getLiveState(guild_id, discord_user_id, platform);
  const wasLive = (state?.is_live ?? 0) === 1;

  if (!wasLive && result.isLive) {
    // Offline → Live: Announcement senden
    await sendAnnouncement(config, streamer, platform, result);
  } else if (wasLive && result.isLive) {
    // Noch live: Nachricht aktualisieren
    await updateAnnouncement(config, streamer, platform, result, state?.announcement_message_id ?? null);
  } else if (wasLive && !result.isLive) {
    // Live → Offline
    upsertLiveState(guild_id, discord_user_id, platform, {
      is_live:                 0,
      announcement_message_id: null,
    });
  }
  // Offline → Offline: nichts tun
}

async function sendAnnouncement(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
): Promise<void> {
  const rawChannel = await _client.channels.fetch(config.live_channel_id!).catch(() => null);
  if (!rawChannel?.isTextBased() || rawChannel.isDMBased()) return;
  const channel = rawChannel;

  const embed      = buildAnnouncementEmbed(result, platform);
  const components = buildAnnouncementComponents(result.url!);
  const content    = buildPingContent(config);

  const msg = await channel.send({ content, embeds: [embed], components });

  upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
    is_live:                 1,
    last_stream_id:          result.streamId ?? null,
    last_live_url:           result.url ?? null,
    last_live_title:         result.title ?? null,
    announcement_message_id: msg.id,
    last_announced_at:       new Date().toISOString(),
  });
}

async function updateAnnouncement(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
  messageId: string | null,
): Promise<void> {
  upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
    last_live_title: result.title ?? null,
  });

  if (!messageId) return;

  try {
    const rawChannel = await _client.channels.fetch(config.live_channel_id!).catch(() => null);
    if (!rawChannel?.isTextBased() || rawChannel.isDMBased()) return;
    const channel = rawChannel;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) {
      // Nachricht gelöscht — messageId leeren, nächster Offline→Online sendet neu
      upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
        announcement_message_id: null,
      });
      return;
    }

    const embed      = buildAnnouncementEmbed(result, platform);
    const components = buildAnnouncementComponents(result.url!);
    await msg.edit({ embeds: [embed], components });
  } catch (err) {
    logger.warn(`[streamer] Announcement-Update fehlgeschlagen: ${err}`);
  }
}

function buildPingContent(config: StreamerConfig): string | undefined {
  switch (config.announcement_ping_type) {
    case 'role':     return config.streamer_role_id ? `<@&${config.streamer_role_id}>` : undefined;
    case 'everyone': return '@everyone';
    case 'here':     return '@here';
    default:         return undefined;
  }
}
