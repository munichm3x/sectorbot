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

export const CREATE_RULES_TABLE = `
  CREATE TABLE IF NOT EXISTS rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT    NOT NULL,
    category        TEXT    NOT NULL,
    title           TEXT    NOT NULL,
    body            TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    public_visible  INTEGER NOT NULL DEFAULT 1,
    created_by      TEXT,
    updated_by      TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  )
`;
export const CREATE_RULES_INDEX = `CREATE INDEX IF NOT EXISTS idx_rules_guild_category ON rules(guild_id, category, sort_order)`;

export const CREATE_PUBLIC_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS public_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT    NOT NULL,
    title           TEXT    NOT NULL,
    description     TEXT,
    event_type      TEXT    NOT NULL DEFAULT 'community',
    starts_at       INTEGER NOT NULL,
    ends_at         INTEGER,
    status          TEXT    NOT NULL DEFAULT 'scheduled',
    discord_url     TEXT,
    banner_url      TEXT,
    public_visible  INTEGER NOT NULL DEFAULT 1,
    created_by      TEXT,
    updated_by      TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  )
`;
export const CREATE_PUBLIC_EVENTS_INDEX = `CREATE INDEX IF NOT EXISTS idx_events_guild_status ON public_events(guild_id, status, starts_at)`;

export const CREATE_CHANGELOG_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS changelog_entries (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id            TEXT    NOT NULL,
    title               TEXT    NOT NULL,
    body                TEXT    NOT NULL,
    category            TEXT    NOT NULL DEFAULT 'server',
    version             TEXT,
    status              TEXT    NOT NULL DEFAULT 'draft',
    published_at        INTEGER,
    discord_message_id  TEXT,
    public_visible      INTEGER NOT NULL DEFAULT 1,
    created_by          TEXT,
    updated_by          TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
  )
`;
export const CREATE_CHANGELOG_ENTRIES_INDEX = `CREATE INDEX IF NOT EXISTS idx_changelog_guild_status ON changelog_entries(guild_id, status, published_at)`;

export const CREATE_PUBLIC_ANNOUNCEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS public_announcements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id            TEXT    NOT NULL,
    title               TEXT    NOT NULL,
    body                TEXT    NOT NULL,
    announcement_type   TEXT    NOT NULL DEFAULT 'info',
    priority            INTEGER NOT NULL DEFAULT 0,
    starts_at           INTEGER NOT NULL,
    ends_at             INTEGER,
    show_as_banner      INTEGER NOT NULL DEFAULT 0,
    active              INTEGER NOT NULL DEFAULT 1,
    public_visible      INTEGER NOT NULL DEFAULT 1,
    created_by          TEXT,
    updated_by          TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
  )
`;
export const CREATE_PUBLIC_ANNOUNCEMENTS_INDEX = `CREATE INDEX IF NOT EXISTS idx_announcements_guild_active ON public_announcements(guild_id, active, starts_at)`;

export const CREATE_FAQ_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS faq_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT    NOT NULL,
    category        TEXT    NOT NULL,
    question        TEXT    NOT NULL,
    answer          TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    public_visible  INTEGER NOT NULL DEFAULT 1,
    created_by      TEXT,
    updated_by      TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  )
`;
export const CREATE_FAQ_ITEMS_INDEX = `CREATE INDEX IF NOT EXISTS idx_faq_guild ON faq_items(guild_id, category, sort_order)`;

export const CREATE_BOT_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS bot_settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT    NOT NULL,
    category        TEXT    NOT NULL,
    setting_key     TEXT    NOT NULL,
    setting_value   TEXT,
    is_secret       INTEGER NOT NULL DEFAULT 0,
    updated_by      TEXT,
    updated_at      INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    UNIQUE(guild_id, category, setting_key)
  )
`;
export const CREATE_BOT_SETTINGS_INDEX = `CREATE INDEX IF NOT EXISTS idx_settings_guild_cat ON bot_settings(guild_id, category)`;

export const CREATE_WIPE_INFO_TABLE = `
  CREATE TABLE IF NOT EXISTS wipe_info (
    guild_id          TEXT    PRIMARY KEY,
    current_season    INTEGER,
    season_name       TEXT,
    last_wipe_at      INTEGER,
    last_wipe_type    TEXT,
    next_wipe_at      INTEGER,
    next_wipe_type    TEXT,
    notes             TEXT,
    public_visible    INTEGER NOT NULL DEFAULT 1,
    updated_by        TEXT,
    updated_at        INTEGER NOT NULL
  )
`;

export const CREATE_SERVER_PUBLIC_INFO_TABLE = `
  CREATE TABLE IF NOT EXISTS server_public_info (
    guild_id              TEXT    PRIMARY KEY,
    server_name           TEXT,
    description           TEXT,
    game_mode             TEXT,
    max_team_size         INTEGER,
    solo_color            TEXT,
    loot_rate             TEXT,
    safezones             INTEGER,
    permadeath            INTEGER,
    vehicle_limit         TEXT,
    base_limit            TEXT,
    restart_times         TEXT,
    map_region            TEXT,
    join_hint             TEXT,
    show_host_in_public   INTEGER NOT NULL DEFAULT 0,
    updated_by            TEXT,
    updated_at            INTEGER NOT NULL
  )
`;
