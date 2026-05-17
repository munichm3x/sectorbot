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
