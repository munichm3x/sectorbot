// src/analytics/analytics.db.ts
// Write and read functions for analytics tables.
// Privacy rules enforced here:
// - voice_session_temp is NEVER returned to any caller outside this file except for cleanup
// - user_id is stored only in voice_session_temp (for session matching) and never in aggregated tables
// - member_events has no user_id column
// - No message content is stored anywhere

import { getDb } from '../db/index';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceSessionRow {
  id: number;
  guild_id: string;
  channel_id: string;
  category_id: string | null;
  user_id: string;
  joined_at: number;
  stream_started_at: number | null;
}

export interface AiEventData {
  guildId: string;
  provider: string;  // 'groq' | 'ollama' | 'openai'
  model: string;
  feature: string;   // 'oldman' | 'ticket_summary' | 'changelog'
  success: boolean;
  error?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  durationMs?: number | null;
}

export interface InteractionEventData {
  guildId: string;
  interactionType: 'command' | 'button' | 'select' | 'modal';
  commandName?: string | null;
  componentId?: string | null;
  feature: string;
  success: boolean;
  durationMs?: number | null;
  errorType?: string | null;
}

export interface AuditLogData {
  guildId: string;
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  success: boolean;
  ipAddress?: string | null;
}

export interface StatusHistoryRow {
  id: number;
  guild_id: string;
  online: number;
  players_online: number | null;
  max_players: number | null;
  ping: number | null;
  error: string | null;
  checked_at: number;
}

export interface AuditLogRow {
  id: number;
  guild_id: string;
  admin_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: string | null;
  new_value: string | null;
  success: number;
  ip_address: string | null;
  created_at: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

function hourBucket(ts: number): number {
  return Math.floor(ts / 3600) * 3600;
}

const SECRET_KEYS = ['secret', 'key', 'token', 'password'];

function maskSecretKeys(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.some(s => k.toLowerCase().includes(s)) ? '[REDACTED]' : v;
  }
  return out;
}

// ─── Message Tracking ─────────────────────────────────────────────────────────

/** Increment the hourly message bucket for a channel. No content stored. */
export function trackMessage(guildId: string, channelId: string, categoryId: string | null): void {
  const db = getDb();
  const now = nowSecs();
  const bucket = hourBucket(now);
  db.prepare(`
    INSERT INTO discord_message_activity
      (guild_id, channel_id, category_id, bucket_start, bucket_type, message_count, created_at)
    VALUES (?, ?, ?, ?, 'hour', 1, ?)
    ON CONFLICT(guild_id, channel_id, bucket_start, bucket_type)
    DO UPDATE SET message_count = message_count + 1
  `).run(guildId, channelId, categoryId, bucket, now);
}

// ─── Voice Tracking ───────────────────────────────────────────────────────────

/** Record a user joining a voice channel. Upserts in case of reconnect. */
export function trackVoiceJoin(guildId: string, channelId: string, categoryId: string | null, userId: string): void {
  const db = getDb();
  const now = nowSecs();
  db.prepare(`
    INSERT INTO voice_session_temp
      (guild_id, channel_id, category_id, user_id, joined_at, stream_started_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      channel_id        = excluded.channel_id,
      category_id       = excluded.category_id,
      joined_at         = excluded.joined_at,
      stream_started_at = NULL
  `).run(guildId, channelId, categoryId, userId, now, now);
}

/** Close a voice session: compute duration and write to aggregated voice bucket. */
export function trackVoiceLeave(guildId: string, userId: string): void {
  const db = getDb();
  const now = nowSecs();
  const session = db.prepare(
    `SELECT * FROM voice_session_temp WHERE guild_id = ? AND user_id = ?`
  ).get(guildId, userId) as VoiceSessionRow | undefined;

  if (!session) return;

  const duration = Math.max(0, now - session.joined_at);
  const bucket = hourBucket(session.joined_at);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO discord_voice_activity
        (guild_id, channel_id, category_id, bucket_start, bucket_type, session_count, total_seconds, stream_session_count, total_stream_seconds, created_at)
      VALUES (?, ?, ?, ?, 'hour', 1, ?, 0, 0, ?)
      ON CONFLICT(guild_id, channel_id, bucket_start, bucket_type)
      DO UPDATE SET
        session_count = session_count + 1,
        total_seconds = total_seconds + excluded.total_seconds
    `).run(session.guild_id, session.channel_id, session.category_id, bucket, duration, now);

    db.prepare(`DELETE FROM voice_session_temp WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
  })();
}

/** Mark stream start time on a temp voice session. */
export function trackStreamStart(guildId: string, userId: string): void {
  const db = getDb();
  const now = nowSecs();
  db.prepare(`
    UPDATE voice_session_temp
    SET stream_started_at = ?
    WHERE guild_id = ? AND user_id = ? AND stream_started_at IS NULL
  `).run(now, guildId, userId);
}

/** Compute stream duration and write to aggregated bucket; clear stream_started_at. */
export function trackStreamStop(guildId: string, userId: string): void {
  const db = getDb();
  const now = nowSecs();
  const session = db.prepare(
    `SELECT * FROM voice_session_temp WHERE guild_id = ? AND user_id = ?`
  ).get(guildId, userId) as VoiceSessionRow | undefined;

  if (!session?.stream_started_at) return;

  const streamDuration = Math.max(0, now - session.stream_started_at);
  const bucket = hourBucket(session.joined_at);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO discord_voice_activity
        (guild_id, channel_id, category_id, bucket_start, bucket_type, session_count, total_seconds, stream_session_count, total_stream_seconds, created_at)
      VALUES (?, ?, ?, ?, 'hour', 0, 0, 1, ?, ?)
      ON CONFLICT(guild_id, channel_id, bucket_start, bucket_type)
      DO UPDATE SET
        stream_session_count = stream_session_count + 1,
        total_stream_seconds = total_stream_seconds + excluded.total_stream_seconds
    `).run(session.guild_id, session.channel_id, session.category_id, bucket, streamDuration, now);

    db.prepare(`
      UPDATE voice_session_temp SET stream_started_at = NULL WHERE guild_id = ? AND user_id = ?
    `).run(guildId, userId);
  })();
}

// ─── Member Events ────────────────────────────────────────────────────────────

/** Record an aggregated join or leave event. No user_id stored. */
export function trackMemberEvent(guildId: string, eventType: 'join' | 'leave'): void {
  const db = getDb();
  db.prepare(`INSERT INTO member_events (guild_id, event_type, created_at) VALUES (?, ?, ?)`).run(guildId, eventType, nowSecs());
}

// ─── AI Events ────────────────────────────────────────────────────────────────

/** Record an AI request (no prompt content stored). */
export function trackAiEvent(data: AiEventData): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO ai_usage_events
      (guild_id, provider, model, feature, success, error, tokens_input, tokens_output, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.guildId, data.provider, data.model, data.feature,
    data.success ? 1 : 0, data.error ?? null,
    data.tokensInput ?? null, data.tokensOutput ?? null,
    data.durationMs ?? null, nowSecs(),
  );
}

// ─── Bot Interaction Events ───────────────────────────────────────────────────

/** Record a bot interaction (command, button, etc.) with timing. */
export function trackInteractionEvent(data: InteractionEventData): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO bot_interaction_events
      (guild_id, interaction_type, command_name, component_id, feature, success, duration_ms, error_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.guildId, data.interactionType,
    data.commandName ?? null, data.componentId ?? null,
    data.feature, data.success ? 1 : 0,
    data.durationMs ?? null, data.errorType ?? null,
    nowSecs(),
  );
}

// ─── Server Status History ────────────────────────────────────────────────────

/** Insert a server status check result. Called from scumStatus.updater.ts. */
export function insertServerStatusHistory(
  guildId:       string,
  online:        boolean,
  playersOnline: number | null,
  maxPlayers:    number | null,
  ping:          number | null,
  error:         string | null,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO server_status_history (guild_id, online, players_online, max_players, ping, error, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, online ? 1 : 0, playersOnline, maxPlayers, ping, error, nowSecs());
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

/** Insert a dashboard admin action audit log entry. Secret values are masked. */
export function insertAuditLog(data: AuditLogData): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO dashboard_audit_logs
      (guild_id, admin_user_id, action, target_type, target_id, old_value, new_value, success, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.guildId, data.adminUserId, data.action,
    data.targetType ?? null, data.targetId ?? null,
    data.oldValue !== undefined ? JSON.stringify(maskSecretKeys(data.oldValue)) : null,
    data.newValue !== undefined ? JSON.stringify(maskSecretKeys(data.newValue)) : null,
    data.success ? 1 : 0,
    data.ipAddress ?? null,
    nowSecs(),
  );
}

// ─── Read Functions ───────────────────────────────────────────────────────────

/** Messages per day for a guild since sinceTs (unix seconds). */
export function getMessagesByDay(guildId: string, sinceTs: number): Array<{ date_ts: number; count: number }> {
  return getDb().prepare(`
    SELECT (bucket_start / 86400) * 86400 AS date_ts, SUM(message_count) AS count
    FROM discord_message_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY date_ts ORDER BY date_ts
  `).all(guildId, sinceTs) as Array<{ date_ts: number; count: number }>;
}

/** Top channels by message count since sinceTs. */
export function getMessagesByChannel(guildId: string, sinceTs: number): Array<{ channel_id: string; count: number }> {
  return getDb().prepare(`
    SELECT channel_id, SUM(message_count) AS count
    FROM discord_message_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY channel_id ORDER BY count DESC LIMIT 20
  `).all(guildId, sinceTs) as Array<{ channel_id: string; count: number }>;
}

/** Total message count since sinceTs. */
export function getMessagesTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(SUM(message_count), 0) AS n FROM discord_message_activity WHERE guild_id = ? AND bucket_start >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Voice seconds per day. */
export function getVoiceByDay(guildId: string, sinceTs: number): Array<{ date_ts: number; total_seconds: number; session_count: number }> {
  return getDb().prepare(`
    SELECT (bucket_start / 86400) * 86400 AS date_ts,
           SUM(total_seconds) AS total_seconds, SUM(session_count) AS session_count
    FROM discord_voice_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY date_ts ORDER BY date_ts
  `).all(guildId, sinceTs) as Array<{ date_ts: number; total_seconds: number; session_count: number }>;
}

/** Top voice channels by total seconds. */
export function getVoiceByChannel(guildId: string, sinceTs: number): Array<{ channel_id: string; total_seconds: number; session_count: number }> {
  return getDb().prepare(`
    SELECT channel_id, SUM(total_seconds) AS total_seconds, SUM(session_count) AS session_count
    FROM discord_voice_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY channel_id ORDER BY total_seconds DESC LIMIT 20
  `).all(guildId, sinceTs) as Array<{ channel_id: string; total_seconds: number; session_count: number }>;
}

/** Total voice seconds. */
export function getVoiceTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(SUM(total_seconds), 0) AS n FROM discord_voice_activity WHERE guild_id = ? AND bucket_start >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Total stream seconds. */
export function getStreamTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(SUM(total_stream_seconds), 0) AS n FROM discord_voice_activity WHERE guild_id = ? AND bucket_start >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Server status history rows. */
export function getServerStatusHistory(guildId: string, sinceTs: number, limit = 500): StatusHistoryRow[] {
  return getDb().prepare(`
    SELECT * FROM server_status_history
    WHERE guild_id = ? AND checked_at >= ?
    ORDER BY checked_at ASC LIMIT ?
  `).all(guildId, sinceTs, limit) as StatusHistoryRow[];
}

/** Latest server status. */
export function getLatestServerStatus(guildId: string): StatusHistoryRow | undefined {
  return getDb().prepare(
    `SELECT * FROM server_status_history WHERE guild_id = ? ORDER BY checked_at DESC LIMIT 1`
  ).get(guildId) as StatusHistoryRow | undefined;
}

/** Peak player count since sinceTs. */
export function getPeakPlayers(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(MAX(players_online), 0) AS n FROM server_status_history WHERE guild_id = ? AND checked_at >= ? AND online = 1`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Member join/leave counts per day. */
export function getMemberEventsByDay(guildId: string, sinceTs: number): Array<{ date_ts: number; joins: number; leaves: number }> {
  return getDb().prepare(`
    SELECT (created_at / 86400) * 86400 AS date_ts,
           SUM(CASE WHEN event_type = 'join'  THEN 1 ELSE 0 END) AS joins,
           SUM(CASE WHEN event_type = 'leave' THEN 1 ELSE 0 END) AS leaves
    FROM member_events WHERE guild_id = ? AND created_at >= ?
    GROUP BY date_ts ORDER BY date_ts
  `).all(guildId, sinceTs) as Array<{ date_ts: number; joins: number; leaves: number }>;
}

/** Total joins since sinceTs. */
export function getMemberJoinsTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(COUNT(*), 0) AS n FROM member_events WHERE guild_id = ? AND event_type = 'join' AND created_at >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** AI usage grouped by feature. */
export function getAiByFeature(guildId: string, sinceTs: number): Array<{ feature: string; total: number; successes: number; errors: number; avg_duration_ms: number | null }> {
  return getDb().prepare(`
    SELECT feature,
           COUNT(*) AS total,
           SUM(success) AS successes,
           SUM(1 - success) AS errors,
           CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms
    FROM ai_usage_events WHERE guild_id = ? AND created_at >= ?
    GROUP BY feature ORDER BY total DESC
  `).all(guildId, sinceTs) as Array<{ feature: string; total: number; successes: number; errors: number; avg_duration_ms: number | null }>;
}

/** AI usage per day. */
export function getAiByDay(guildId: string, sinceTs: number): Array<{ date_ts: number; total: number; successes: number }> {
  return getDb().prepare(`
    SELECT (created_at / 86400) * 86400 AS date_ts, COUNT(*) AS total, SUM(success) AS successes
    FROM ai_usage_events WHERE guild_id = ? AND created_at >= ?
    GROUP BY date_ts ORDER BY date_ts
  `).all(guildId, sinceTs) as Array<{ date_ts: number; total: number; successes: number }>;
}

/** Total AI requests. */
export function getAiTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(COUNT(*), 0) AS n FROM ai_usage_events WHERE guild_id = ? AND created_at >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Top commands by usage count. */
export function getCommandUsage(guildId: string, sinceTs: number): Array<{ command_name: string; total: number; successes: number; errors: number; avg_duration_ms: number | null }> {
  return getDb().prepare(`
    SELECT COALESCE(command_name, 'unknown') AS command_name,
           COUNT(*) AS total,
           SUM(success) AS successes,
           SUM(1 - success) AS errors,
           CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms
    FROM bot_interaction_events
    WHERE guild_id = ? AND created_at >= ? AND interaction_type = 'command'
    GROUP BY command_name ORDER BY total DESC LIMIT 25
  `).all(guildId, sinceTs) as Array<{ command_name: string; total: number; successes: number; errors: number; avg_duration_ms: number | null }>;
}

/** Total bot interactions. */
export function getInteractionsTotal(guildId: string, sinceTs: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(COUNT(*), 0) AS n FROM bot_interaction_events WHERE guild_id = ? AND created_at >= ?`
  ).get(guildId, sinceTs) as { n: number };
  return row.n;
}

/** Audit log rows. */
export function getAuditLogs(guildId: string, limit: number): AuditLogRow[] {
  return getDb().prepare(
    `SELECT * FROM dashboard_audit_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(guildId, limit) as AuditLogRow[];
}

// ─── Cleanup (called by aggregator) ──────────────────────────────────────────

/** Delete raw event rows older than retentionDays. */
export function purgeOldRawEvents(retentionDays: number): void {
  const db = getDb();
  const cutoff = nowSecs() - retentionDays * 86400;
  db.prepare(`DELETE FROM bot_interaction_events WHERE created_at < ?`).run(cutoff);
  db.prepare(`DELETE FROM ai_usage_events WHERE created_at < ?`).run(cutoff);
  const memberCutoff = nowSecs() - 90 * 86400; // always keep 90 days of member events
  db.prepare(`DELETE FROM member_events WHERE created_at < ?`).run(memberCutoff);
}

// ─── Elite Analytics: New Aggregation Functions ──────────────────────────────

/**
 * Activity heatmap: aggregated message counts by (weekday, hour-of-day).
 * Returns array of { weekday: 0-6, hour: 0-23, count: number }
 * weekday 0 = Monday (ISO), 6 = Sunday
 */
export function getMessageHeatmap(guildId: string, sinceTs: number): Array<{ weekday: number; hour: number; count: number }> {
  const rows = getDb().prepare(`
    SELECT
      CAST(strftime('%w', bucket_start, 'unixepoch') AS INTEGER) AS dow_sun_first,
      CAST(strftime('%H', bucket_start, 'unixepoch') AS INTEGER) AS hour,
      SUM(message_count) AS count
    FROM discord_message_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY dow_sun_first, hour
  `).all(guildId, sinceTs) as Array<{ dow_sun_first: number; hour: number; count: number }>;

  return rows.map(r => ({
    weekday: r.dow_sun_first === 0 ? 6 : r.dow_sun_first - 1,
    hour: r.hour,
    count: r.count,
  }));
}

/**
 * Voice activity heatmap — same structure as message heatmap.
 * Uses total_seconds (total voice time in seconds for that hour×weekday slot).
 */
export function getVoiceHeatmap(guildId: string, sinceTs: number): Array<{ weekday: number; hour: number; seconds: number }> {
  const rows = getDb().prepare(`
    SELECT
      CAST(strftime('%w', bucket_start, 'unixepoch') AS INTEGER) AS dow_sun_first,
      CAST(strftime('%H', bucket_start, 'unixepoch') AS INTEGER) AS hour,
      SUM(total_seconds) AS seconds
    FROM discord_voice_activity
    WHERE guild_id = ? AND bucket_start >= ?
    GROUP BY dow_sun_first, hour
  `).all(guildId, sinceTs) as Array<{ dow_sun_first: number; hour: number; seconds: number }>;

  return rows.map(r => ({
    weekday: r.dow_sun_first === 0 ? 6 : r.dow_sun_first - 1,
    hour: r.hour,
    seconds: r.seconds,
  }));
}

/**
 * Hourly breakdown combining message and voice data.
 * Returns array of { hour_ts, message_count, voice_seconds, stream_seconds }
 */
export function getActivityByHour(guildId: string, sinceTs: number): Array<{
  hour_ts: number; message_count: number; voice_seconds: number; stream_seconds: number;
}> {
  const rows = getDb().prepare(`
    WITH hours AS (
      SELECT DISTINCT (bucket_start / 3600) * 3600 AS hour_ts
      FROM discord_message_activity
      WHERE guild_id = ? AND bucket_start >= ?
      UNION
      SELECT DISTINCT (bucket_start / 3600) * 3600 AS hour_ts
      FROM discord_voice_activity
      WHERE guild_id = ? AND bucket_start >= ?
    )
    SELECT
      h.hour_ts,
      COALESCE((
        SELECT SUM(message_count)
        FROM discord_message_activity
        WHERE guild_id = ? AND (bucket_start / 3600) * 3600 = h.hour_ts
      ), 0) AS message_count,
      COALESCE((
        SELECT SUM(total_seconds)
        FROM discord_voice_activity
        WHERE guild_id = ? AND (bucket_start / 3600) * 3600 = h.hour_ts
      ), 0) AS voice_seconds,
      COALESCE((
        SELECT SUM(total_stream_seconds)
        FROM discord_voice_activity
        WHERE guild_id = ? AND (bucket_start / 3600) * 3600 = h.hour_ts
      ), 0) AS stream_seconds
    FROM hours h
    ORDER BY h.hour_ts ASC
  `).all(guildId, sinceTs, guildId, sinceTs, guildId, guildId, guildId) as Array<{ hour_ts: number; message_count: number; voice_seconds: number; stream_seconds: number }>;
  return rows;
}

/**
 * Bot interaction events summary (commands, errors, total).
 */
export function getInteractionStats(guildId: string, sinceTs: number): {
  total: number;
  successes: number;
  errors: number;
  uniqueCommands: number;
  avgDurationMs: number | null;
} {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS errors,
      COUNT(DISTINCT command_name) AS uniqueCommands,
      AVG(duration_ms) AS avgDurationMs
    FROM bot_interaction_events
    WHERE guild_id = ? AND created_at >= ?
  `).get(guildId, sinceTs) as { total: number; successes: number; errors: number; uniqueCommands: number; avgDurationMs: number | null } | undefined;
  return row ?? { total: 0, successes: 0, errors: 0, uniqueCommands: 0, avgDurationMs: null };
}

/** Delete server_status_history rows older than retentionDays. */
export function purgeOldStatusHistory(retentionDays: number): void {
  const cutoff = nowSecs() - retentionDays * 86400;
  getDb().prepare(`DELETE FROM server_status_history WHERE checked_at < ?`).run(cutoff);
}

/** Close stale voice sessions older than 4 hours (bot restart recovery). */
export function closeStaleVoiceSessions(): void {
  const db = getDb();
  const staleThreshold = nowSecs() - 4 * 3600;
  const stale = db.prepare(
    `SELECT * FROM voice_session_temp WHERE joined_at < ?`
  ).all(staleThreshold) as VoiceSessionRow[];

  for (const session of stale) {
    const duration = Math.max(0, staleThreshold - session.joined_at);
    const bucket = hourBucket(session.joined_at);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO discord_voice_activity
          (guild_id, channel_id, category_id, bucket_start, bucket_type, session_count, total_seconds, stream_session_count, total_stream_seconds, created_at)
        VALUES (?, ?, ?, ?, 'hour', 1, ?, 0, 0, ?)
        ON CONFLICT(guild_id, channel_id, bucket_start, bucket_type)
        DO UPDATE SET session_count = session_count + 1, total_seconds = total_seconds + excluded.total_seconds
      `).run(session.guild_id, session.channel_id, session.category_id, bucket, duration, nowSecs());
      db.prepare(`DELETE FROM voice_session_temp WHERE id = ?`).run(session.id);
    })();
  }
}
