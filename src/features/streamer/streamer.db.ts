// src/features/streamer/streamer.db.ts
import { getDb } from '../../db/index';
import type { StreamerConfig, Streamer, StreamLiveState, PingType } from './streamer.types';

// ── streamer_config ────────────────────────────────────────────────────────────

export function getStreamerConfig(guildId: string): StreamerConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM streamer_config WHERE guild_id = ?')
    .get(guildId) as StreamerConfig | undefined;
}

export function upsertStreamerConfig(
  guildId: string,
  data: Partial<Omit<StreamerConfig, 'guild_id' | 'created_at' | 'updated_at'>>,
): StreamerConfig {
  const db = getDb();
  db.prepare(`
    INSERT INTO streamer_config (guild_id, updated_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET updated_at = datetime('now')
  `).run(guildId);

  const fields = Object.entries(data)
    .map(([k]) => `${k} = @${k}`)
    .join(', ');

  if (fields) {
    db.prepare(`UPDATE streamer_config SET ${fields}, updated_at = datetime('now') WHERE guild_id = @guild_id`)
      .run({ guild_id: guildId, ...data });
  }

  return getStreamerConfig(guildId)!;
}

export function getAllActiveStreamerConfigs(): StreamerConfig[] {
  return getDb()
    .prepare(`SELECT * FROM streamer_config WHERE enabled = 1 AND setup_completed = 1`)
    .all() as StreamerConfig[];
}

export function setStreamerLastSuccessfulCheck(guildId: string): void {
  getDb()
    .prepare(`UPDATE streamer_config SET last_successful_check = datetime('now'), last_error = NULL WHERE guild_id = ?`)
    .run(guildId);
}

export function setStreamerLastError(guildId: string, error: string): void {
  getDb()
    .prepare(`UPDATE streamer_config SET last_error = ? WHERE guild_id = ?`)
    .run(error.slice(0, 500), guildId);
}

// ── streamers ──────────────────────────────────────────────────────────────────

export function getStreamer(guildId: string, discordUserId: string): Streamer | undefined {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? AND discord_user_id = ?')
    .get(guildId, discordUserId) as Streamer | undefined;
}

export function getEnabledStreamers(guildId: string): Streamer[] {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? AND enabled = 1')
    .all(guildId) as Streamer[];
}

export function getAllStreamers(guildId: string): Streamer[] {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? ORDER BY created_at ASC')
    .all(guildId) as Streamer[];
}

export function upsertStreamer(
  guildId: string,
  discordUserId: string,
  data: { twitch_username?: string | null; youtube_channel_id?: string | null },
): Streamer {
  const db = getDb();
  const existing = getStreamer(guildId, discordUserId);
  if (existing) {
    db.prepare(`
      UPDATE streamers SET
        twitch_username    = COALESCE(?, twitch_username),
        youtube_channel_id = COALESCE(?, youtube_channel_id),
        updated_at         = datetime('now')
      WHERE guild_id = ? AND discord_user_id = ?
    `).run(data.twitch_username ?? null, data.youtube_channel_id ?? null, guildId, discordUserId);
  } else {
    db.prepare(`
      INSERT INTO streamers (guild_id, discord_user_id, twitch_username, youtube_channel_id, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).run(guildId, discordUserId, data.twitch_username ?? null, data.youtube_channel_id ?? null);
  }
  return getStreamer(guildId, discordUserId)!;
}

export function setStreamerEnabled(guildId: string, discordUserId: string, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE streamers SET enabled = ?, updated_at = datetime('now') WHERE guild_id = ? AND discord_user_id = ?`)
    .run(enabled ? 1 : 0, guildId, discordUserId);
}

export function deleteStreamer(guildId: string, discordUserId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ?').run(guildId, discordUserId);
  db.prepare('DELETE FROM streamers WHERE guild_id = ? AND discord_user_id = ?').run(guildId, discordUserId);
}

export function countStreamers(guildId: string): { total: number; active: number } {
  const total  = (getDb().prepare('SELECT COUNT(*) as c FROM streamers WHERE guild_id = ?').get(guildId) as { c: number }).c;
  const active = (getDb().prepare('SELECT COUNT(*) as c FROM streamers WHERE guild_id = ? AND enabled = 1').get(guildId) as { c: number }).c;
  return { total, active };
}

// ── stream_live_states ─────────────────────────────────────────────────────────

export function getLiveState(
  guildId: string,
  discordUserId: string,
  platform: 'twitch' | 'youtube',
): StreamLiveState | undefined {
  return getDb()
    .prepare('SELECT * FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ? AND platform = ?')
    .get(guildId, discordUserId, platform) as StreamLiveState | undefined;
}

export function upsertLiveState(
  guildId: string,
  discordUserId: string,
  platform: 'twitch' | 'youtube',
  data: Partial<Omit<StreamLiveState, 'id' | 'guild_id' | 'discord_user_id' | 'platform' | 'created_at' | 'updated_at'>>,
): void {
  const db = getDb();
  const existing = getLiveState(guildId, discordUserId, platform);

  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    if (sets) {
      db.prepare(`UPDATE stream_live_states SET ${sets}, last_checked_at = datetime('now'), updated_at = datetime('now') WHERE guild_id = @guild_id AND discord_user_id = @discord_user_id AND platform = @platform`)
        .run({ guild_id: guildId, discord_user_id: discordUserId, platform, ...data });
    }
  } else {
    db.prepare(`
      INSERT INTO stream_live_states (guild_id, discord_user_id, platform, last_checked_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(guildId, discordUserId, platform);
    if (Object.keys(data).length > 0) {
      upsertLiveState(guildId, discordUserId, platform, data);
    }
  }
}

export function getLiveStatesForStreamer(guildId: string, discordUserId: string): StreamLiveState[] {
  return getDb()
    .prepare('SELECT * FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ?')
    .all(guildId, discordUserId) as StreamLiveState[];
}
