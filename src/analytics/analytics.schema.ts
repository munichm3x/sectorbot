// src/analytics/analytics.schema.ts
// All CREATE TABLE + CREATE INDEX statements for analytics tables.
// Each export is a single SQL string passed to db.exec().
// better-sqlite3 db.exec() supports multiple semicolon-separated statements.

export const CREATE_SERVER_STATUS_HISTORY = `
  CREATE TABLE IF NOT EXISTS server_status_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id       TEXT    NOT NULL,
    online         INTEGER NOT NULL,
    players_online INTEGER,
    max_players    INTEGER,
    ping           INTEGER,
    error          TEXT,
    checked_at     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ssh_guild_checked
    ON server_status_history(guild_id, checked_at);
`;

export const CREATE_DISCORD_MESSAGE_ACTIVITY = `
  CREATE TABLE IF NOT EXISTS discord_message_activity (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id          TEXT    NOT NULL,
    channel_id        TEXT    NOT NULL,
    category_id       TEXT,
    bucket_start      INTEGER NOT NULL,
    bucket_type       TEXT    NOT NULL,
    message_count     INTEGER NOT NULL DEFAULT 0,
    unique_user_count INTEGER,
    created_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_bucket
    ON discord_message_activity(guild_id, channel_id, bucket_start, bucket_type);
  CREATE INDEX IF NOT EXISTS idx_dma_guild_bucket
    ON discord_message_activity(guild_id, bucket_start, bucket_type);
`;

export const CREATE_VOICE_SESSION_TEMP = `
  CREATE TABLE IF NOT EXISTS voice_session_temp (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id          TEXT    NOT NULL,
    channel_id        TEXT    NOT NULL,
    category_id       TEXT,
    user_id           TEXT    NOT NULL,
    joined_at         INTEGER NOT NULL,
    stream_started_at INTEGER,
    created_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vst_user
    ON voice_session_temp(guild_id, user_id);
`;

export const CREATE_DISCORD_VOICE_ACTIVITY = `
  CREATE TABLE IF NOT EXISTS discord_voice_activity (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id             TEXT    NOT NULL,
    channel_id           TEXT    NOT NULL,
    category_id          TEXT,
    bucket_start         INTEGER NOT NULL,
    bucket_type          TEXT    NOT NULL,
    session_count        INTEGER NOT NULL DEFAULT 0,
    total_seconds        INTEGER NOT NULL DEFAULT 0,
    stream_session_count INTEGER NOT NULL DEFAULT 0,
    total_stream_seconds INTEGER NOT NULL DEFAULT 0,
    max_concurrent_users INTEGER,
    created_at           INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_dva_bucket
    ON discord_voice_activity(guild_id, channel_id, bucket_start, bucket_type);
  CREATE INDEX IF NOT EXISTS idx_dva_guild_bucket
    ON discord_voice_activity(guild_id, bucket_start, bucket_type);
`;

export const CREATE_BOT_INTERACTION_EVENTS = `
  CREATE TABLE IF NOT EXISTS bot_interaction_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id         TEXT    NOT NULL,
    interaction_type TEXT    NOT NULL,
    command_name     TEXT,
    component_id     TEXT,
    feature          TEXT    NOT NULL,
    success          INTEGER NOT NULL DEFAULT 1,
    duration_ms      INTEGER,
    error_type       TEXT,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_bie_guild_created
    ON bot_interaction_events(guild_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_bie_command
    ON bot_interaction_events(guild_id, command_name, created_at);
`;

export const CREATE_AI_USAGE_EVENTS = `
  CREATE TABLE IF NOT EXISTS ai_usage_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT    NOT NULL,
    provider     TEXT    NOT NULL,
    model        TEXT,
    feature      TEXT    NOT NULL,
    success      INTEGER NOT NULL DEFAULT 1,
    error        TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    duration_ms  INTEGER,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_aue_guild_created
    ON ai_usage_events(guild_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_aue_feature
    ON ai_usage_events(guild_id, feature, created_at);
`;

export const CREATE_MEMBER_EVENTS = `
  CREATE TABLE IF NOT EXISTS member_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT    NOT NULL,
    event_type TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_me_guild_created
    ON member_events(guild_id, created_at);
`;

export const CREATE_DASHBOARD_AUDIT_LOGS = `
  CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT    NOT NULL,
    admin_user_id TEXT    NOT NULL,
    action        TEXT    NOT NULL,
    target_type   TEXT,
    target_id     TEXT,
    old_value     TEXT,
    new_value     TEXT,
    success       INTEGER NOT NULL DEFAULT 1,
    ip_address    TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_dal_guild_created
    ON dashboard_audit_logs(guild_id, created_at);
`;
