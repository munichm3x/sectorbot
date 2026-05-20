// src/analytics/analytics.tracker.ts
// Sets up Discord event listeners that feed data into analytics tables.
// Privacy rules:
// - messageCreate: only count, never read content
// - voiceStateUpdate: only track join/leave/stream times
// - guildMemberAdd/Remove: only record event type, not user ID

import type { Client } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  trackMessage, trackVoiceJoin, trackVoiceLeave,
  trackStreamStart, trackStreamStop, trackMemberEvent,
} from './analytics.db';

export function setupAnalyticsTracking(client: Client): void {
  if (!env.ANALYTICS_ENABLED) {
    logger.info('[analytics] Analytics deaktiviert (ANALYTICS_ENABLED=false).');
    return;
  }

  // ── Message counting ───────────────────────────────────────────────────────
  if (env.ANALYTICS_MESSAGE_ENABLED) {
    client.on('messageCreate', (msg) => {
      if (msg.author.bot || !msg.guildId) return;
      try {
        const categoryId = 'parentId' in msg.channel ? (msg.channel as { parentId?: string | null }).parentId ?? null : null;
        trackMessage(msg.guildId, msg.channelId, categoryId);
      } catch (err) {
        logger.debug('[analytics] messageCreate Fehler:', err);
      }
    });
    logger.info('[analytics] Message-Tracking aktiv.');
  }

  // ── Voice / Stream tracking ────────────────────────────────────────────────
  if (env.ANALYTICS_VOICE_ENABLED) {
    client.on('voiceStateUpdate', (oldState, newState) => {
      const guildId = newState.guild.id;
      const userId = oldState.member?.id ?? newState.member?.id;
      if (!userId) return;

      const wasInChannel = oldState.channelId !== null;
      const isInChannel = newState.channelId !== null;
      const wasStreaming = oldState.streaming ?? false;
      const isStreaming = newState.streaming ?? false;

      try {
        if (wasInChannel && !isInChannel) {
          // Left voice
          if (wasStreaming && env.ANALYTICS_STREAM_ENABLED) trackStreamStop(guildId, userId);
          trackVoiceLeave(guildId, userId);

        } else if (!wasInChannel && isInChannel) {
          // Joined voice
          const channelId = newState.channelId!;
          const categoryId = newState.channel?.parentId ?? null;
          trackVoiceJoin(guildId, channelId, categoryId, userId);
          if (isStreaming && env.ANALYTICS_STREAM_ENABLED) trackStreamStart(guildId, userId);

        } else if (wasInChannel && isInChannel && oldState.channelId !== newState.channelId) {
          // Moved channels — treat as leave old + join new
          if (wasStreaming && env.ANALYTICS_STREAM_ENABLED) trackStreamStop(guildId, userId);
          trackVoiceLeave(guildId, userId);
          const channelId = newState.channelId!;
          const categoryId = newState.channel?.parentId ?? null;
          trackVoiceJoin(guildId, channelId, categoryId, userId);
          if (isStreaming && env.ANALYTICS_STREAM_ENABLED) trackStreamStart(guildId, userId);

        } else if (wasInChannel && isInChannel) {
          // Same channel — check stream state change
          if (env.ANALYTICS_STREAM_ENABLED) {
            if (!wasStreaming && isStreaming) trackStreamStart(guildId, userId);
            else if (wasStreaming && !isStreaming) trackStreamStop(guildId, userId);
          }
        }
      } catch (err) {
        logger.debug('[analytics] voiceStateUpdate Fehler:', err);
      }
    });
    logger.info('[analytics] Voice/Stream-Tracking aktiv.');
  }

  // ── Member growth ──────────────────────────────────────────────────────────
  client.on('guildMemberAdd', (member) => {
    try { trackMemberEvent(member.guild.id, 'join'); } catch { /* silent */ }
  });

  client.on('guildMemberRemove', (member) => {
    try { trackMemberEvent(member.guild.id, 'leave'); } catch { /* silent */ }
  });

  logger.info('[analytics] Analytics-Tracking vollständig eingerichtet.');
}
