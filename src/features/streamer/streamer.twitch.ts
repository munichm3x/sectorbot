// src/features/streamer/streamer.twitch.ts
import { logger } from '../../utils/logger';
import type { LiveResult, StreamerConfig } from './streamer.types';

interface TokenCache {
  token:     string;
  expiresAt: number;
}

// Per guild_id own token cache (different Client-IDs possible)
const tokenCache = new Map<string, TokenCache>();

async function getAppAccessToken(
  clientId: string,
  clientSecret: string,
  cacheKey: string,
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch Token-Fehler: HTTP ${res.status}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt });
  return data.access_token;
}

export function clearTwitchTokenCache(guildId: string): void {
  tokenCache.delete(guildId);
}

export async function checkTwitchStream(
  config: StreamerConfig,
  username: string,
): Promise<LiveResult> {
  if (!config.twitch_client_id || !config.twitch_client_secret) {
    return { isLive: false };
  }

  try {
    const token = await getAppAccessToken(
      config.twitch_client_id,
      config.twitch_client_secret,
      config.guild_id,
    );

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          'Client-Id':     config.twitch_client_id,
          'Authorization': `Bearer ${token}`,
        },
      },
    );

    if (res.status === 401) {
      // Token invalid — clear cache and retry once
      clearTwitchTokenCache(config.guild_id);
      return checkTwitchStream(config, username);
    }

    if (!res.ok) {
      throw new Error(`Twitch API HTTP ${res.status}`);
    }

    const data = await res.json() as {
      data: Array<{
        id: string;
        user_login: string;
        user_name: string;
        title: string;
        game_name: string;
        viewer_count: number;
        thumbnail_url: string;
        started_at: string;
      }>;
    };

    const stream = data.data[0];
    if (!stream) return { isLive: false };

    const thumbUrl = stream.thumbnail_url
      .replace('{width}', '1280')
      .replace('{height}', '720');

    return {
      isLive:       true,
      streamId:     stream.id,
      title:        stream.title,
      gameName:     stream.game_name,
      viewerCount:  stream.viewer_count,
      thumbnailUrl: thumbUrl,
      startedAt:    stream.started_at,
      url:          `https://twitch.tv/${stream.user_login}`,
      userName:     stream.user_name,
    };
  } catch (err) {
    // Never log secrets
    // Re-throw so the per-streamer error handler in runGuildCheck catches this.
    // Returning { isLive: false } on network failures would cause the bot to
    // treat every failed API call as "stream went offline" and post repeated
    // offline embeds. State transitions must only happen on successful API responses.
    logger.warn(`[streamer] Twitch-Fehler für ${username}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
