export const CREATE_TICKETS_TABLE = `
  CREATE TABLE IF NOT EXISTS tickets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id       TEXT    NOT NULL,
    channel_id     TEXT    NOT NULL UNIQUE,
    opener_user_id TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'open',
    claimed_by     TEXT,
    created_at     INTEGER NOT NULL,
    closed_at      INTEGER
  )
`;

export const CREATE_PANELS_TABLE = `
  CREATE TABLE IF NOT EXISTS panels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    type       TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    UNIQUE(guild_id, type)
  )
`;

export const CREATE_GUILD_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id                TEXT PRIMARY KEY,
    ticket_panel_channel_id TEXT,
    ticket_category_id      TEXT,
    ticket_log_channel_id   TEXT,
    rules_channel_id        TEXT,
    whitelist_role_id       TEXT,
    ticket_panel_message_id TEXT,
    rules_message_id        TEXT,
    setup_completed         INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
  )
`;

export const CREATE_GUILD_SUPPORT_ROLES_TABLE = `
  CREATE TABLE IF NOT EXISTS guild_support_roles (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id  TEXT NOT NULL,
    UNIQUE(guild_id, role_id)
  )
`;

export const CREATE_TICKET_CATEGORY_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS ticket_category_config (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    UNIQUE(guild_id, key)
  )
`;

export const CREATE_OLDMAN_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS oldman_config (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL
  )
`;

export const CREATE_CHANGELOG_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS changelog_config (
    guild_id          TEXT PRIMARY KEY,
    create_channel_id TEXT,
    public_channel_id TEXT,
    dashboard_msg_id  TEXT
  )
`;

export const CREATE_SCUM_STATUS_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS scum_status_config (
    guild_id              TEXT    PRIMARY KEY,
    enabled               INTEGER NOT NULL DEFAULT 0,
    channel_id            TEXT,
    message_id            TEXT,
    host                  TEXT,
    query_port            INTEGER,
    update_interval_secs  INTEGER NOT NULL DEFAULT 60,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_STREAMER_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS streamer_config (
    guild_id                TEXT    PRIMARY KEY,
    enabled                 INTEGER NOT NULL DEFAULT 0,
    setup_completed         INTEGER NOT NULL DEFAULT 0,
    streamer_role_id        TEXT    NULL,
    live_channel_id         TEXT    NULL,
    check_interval_seconds  INTEGER NOT NULL DEFAULT 120,
    twitch_client_id        TEXT    NULL,
    twitch_client_secret    TEXT    NULL,
    youtube_api_key         TEXT    NULL,
    announcement_ping_type  TEXT    NOT NULL DEFAULT 'none',
    last_successful_check   TEXT    NULL,
    last_error              TEXT    NULL,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_STREAMERS_TABLE = `
  CREATE TABLE IF NOT EXISTS streamers (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id           TEXT    NOT NULL,
    discord_user_id    TEXT    NOT NULL,
    twitch_username    TEXT    NULL,
    youtube_channel_id TEXT    NULL,
    enabled            INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, discord_user_id)
  )
`;

export const CREATE_STREAM_LIVE_STATES_TABLE = `
  CREATE TABLE IF NOT EXISTS stream_live_states (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id                TEXT    NOT NULL,
    discord_user_id         TEXT    NOT NULL,
    platform                TEXT    NOT NULL,
    is_live                 INTEGER NOT NULL DEFAULT 0,
    last_stream_id          TEXT    NULL,
    last_live_url           TEXT    NULL,
    last_live_title         TEXT    NULL,
    announcement_message_id TEXT    NULL,
    last_checked_at         TEXT    NULL,
    last_announced_at       TEXT    NULL,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, discord_user_id, platform)
  )
`;
