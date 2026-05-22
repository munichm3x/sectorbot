// src/features/streamer/streamer.youtube.ts
import { logger } from '../../utils/logger';
import type { LiveResult } from './streamer.types';

export async function checkYouTubeStream(
  apiKey: string,
  channelId: string,
): Promise<LiveResult> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part',      'snippet');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('eventType', 'live');
    url.searchParams.set('type',      'video');
    url.searchParams.set('key',       apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error(`YouTube API HTTP ${res.status}`);
    }

    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { high?: { url: string } };
        };
      }>;
    };

    const item = data.items?.[0];
    if (!item) return { isLive: false };

    return {
      isLive:       true,
      streamId:     item.id.videoId,
      title:        item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high?.url,
      startedAt:    item.snippet.publishedAt,
      url:          `https://www.youtube.com/watch?v=${item.id.videoId}`,
      userName:     item.snippet.channelTitle,
    };
  } catch (err) {
    // Re-throw so the per-streamer error handler in runGuildCheck catches this.
    // Returning { isLive: false } on network failures would cause repeated
    // offline embeds whenever the YouTube API is temporarily unreachable.
    logger.warn(`[streamer] YouTube-Fehler für ${channelId}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
