# Dashboard Sub-project A: Analytics Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add analytics tracking to the existing Discord bot: new SQLite tables for message, voice, stream, member, command, AI, and server-status events; Discord event listeners that populate those tables; and a retention/cleanup job — all without breaking any existing bot functionality.

**Architecture:** New `src/analytics/` module with three files (schema, db, tracker) plus a lightweight aggregator. All DB access goes through `getDb()` from the existing `src/db/index.ts`. Event listeners are set up by calling `setupAnalyticsTracking(client)` from `src/index.ts`. All analytics data is stored aggregated in bucketed SQLite tables; raw temp data (voice sessions) is cleared after aggregation.

**Tech Stack:** TypeScript, better-sqlite3 (existing), Discord.js v14 (existing), vitest (existing for tests).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/analytics/analytics.schema.ts` | Create | CREATE TABLE SQL for all analytics tables |
| `src/analytics/analytics.db.ts` | Create | Write + read functions for all analytics tables |
| `src/analytics/analytics.tracker.ts` | Create | Discord event listeners; calls analytics.db.ts |
| `src/analytics/analytics.aggregator.ts` | Create | Retention/cleanup job (runs every 15 min) |
| `src/analytics/index.ts` | Create | Re-exports setupAnalyticsTracking, setupAggregator |
| `src/db/index.ts` | Modify | Add `initAnalyticsDb()` call inside `initDb()` |
| `src/config/env.ts` | Modify | Add analytics + dashboard env vars |
| `src/utils/logger.ts` | Modify | Add in-memory ring buffer for log streaming |
| `src/features/scumStatus/scumStatus.updater.ts` | Modify | Insert row into server_status_history after each check |
| `src/features/oldManLore.ts` | Modify | Call trackAiEvent() after each LLM call |
| `src/client.ts` | Modify | Wrap interaction dispatch to time + record bot_interaction_events |
| `src/index.ts` | Modify | Call setupAnalyticsTracking(client) + setupAggregator() |
| `.env.example` | Create | Document all environment variables |

---

### Task 1: Add Analytics + Dashboard ENV vars

**Files:**
- Modify: `src/config/env.ts`
- Create: `.env.example`

- [ ] **Step 1: Read the current env.ts**

```
Current file: src/config/env.ts  (already read in context)
```

- [ ] **Step 2: Replace env.ts with the expanded version**

Replace the entire file content with:

```typescript
import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

function envInt(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  if (process.env[key] === undefined) return fallback;
  return process.env[key] !== 'false' && process.env[key] !== '0';
}

function envList(key: string): string[] {
  return (process.env[key] ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export const env = {
  // Bot core
  DISCORD_TOKEN:       requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:           requireEnv('CLIENT_ID'),
  DATABASE_PATH:       process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:            process.env.NODE_ENV ?? 'development',

  // AI
  OLLAMA_URL:          process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:        process.env.OLLAMA_MODEL ?? 'sector13-oldman',
  OLD_MAN_COOLDOWN_MS: envInt('OLD_MAN_COOLDOWN_MS', 5000),
  OLLAMA_TIMEOUT_MS:   envInt('OLLAMA_TIMEOUT_MS', 60000),
  GROQ_API_KEY:        process.env.GROQ_API_KEY ?? '',

  // External
  STEAM_API_KEY:           process.env.STEAM_API_KEY ?? '',
  RULES_BANNER_URL:        process.env.RULES_BANNER_URL ?? '',
  SCUM_STATUS_LOGO_URL:    process.env.SCUM_STATUS_LOGO_URL ?? '',
  SCUM_STATUS_BANNER_URL:  process.env.SCUM_STATUS_BANNER_URL ?? '',

  // Analytics
  ANALYTICS_ENABLED:                    envBool('ANALYTICS_ENABLED', true),
  ANALYTICS_MESSAGE_ENABLED:            envBool('ANALYTICS_MESSAGE_ENABLED', true),
  ANALYTICS_VOICE_ENABLED:              envBool('ANALYTICS_VOICE_ENABLED', true),
  ANALYTICS_STREAM_ENABLED:             envBool('ANALYTICS_STREAM_ENABLED', true),
  ANALYTICS_AI_ENABLED:                 envBool('ANALYTICS_AI_ENABLED', true),
  ANALYTICS_RETENTION_RAW_DAYS:         envInt('ANALYTICS_RETENTION_RAW_DAYS', 7),
  ANALYTICS_RETENTION_AGGREGATED_DAYS:  envInt('ANALYTICS_RETENTION_AGGREGATED_DAYS', 365),
  ANALYTICS_AGGREGATION_INTERVAL_MIN:   envInt('ANALYTICS_AGGREGATION_INTERVAL_MINUTES', 15),

  // Dashboard
  DASHBOARD_ENABLED:              envBool('DASHBOARD_ENABLED', false),
  DASHBOARD_PORT:                 envInt('DASHBOARD_PORT', 3000),
  DASHBOARD_SESSION_SECRET:       process.env.DASHBOARD_SESSION_SECRET ?? 'change-me-in-production',
  DISCORD_CLIENT_SECRET:          process.env.DISCORD_CLIENT_SECRET ?? '',
  DISCORD_OAUTH_CALLBACK_URL:     process.env.DISCORD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/callback',
  DASHBOARD_ALLOWED_USER_IDS:     envList('DASHBOARD_ALLOWED_USER_IDS'),
  DASHBOARD_ADMIN_ROLE_IDS:       envList('DASHBOARD_ADMIN_ROLE_IDS'),
  DASHBOARD_MOD_ROLE_IDS:         envList('DASHBOARD_MOD_ROLE_IDS'),
} as const;
```

- [ ] **Step 3: Create .env.example**

Create `.env.example` at project root:

```env
# ─── Bot Core ─────────────────────────────────────────────────────────────────
DISCORD_TOKEN=
CLIENT_ID=
DATABASE_PATH=./data/bot.db
NODE_ENV=production

# ─── AI ───────────────────────────────────────────────────────────────────────
GROQ_API_KEY=
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=sector13-oldman
OLD_MAN_COOLDOWN_MS=8000
OLLAMA_TIMEOUT_MS=60000

# ─── External ─────────────────────────────────────────────────────────────────
STEAM_API_KEY=
RULES_BANNER_URL=
SCUM_STATUS_LOGO_URL=
SCUM_STATUS_BANNER_URL=

# ─── Analytics ────────────────────────────────────────────────────────────────
ANALYTICS_ENABLED=true
ANALYTICS_MESSAGE_ENABLED=true
ANALYTICS_VOICE_ENABLED=true
ANALYTICS_STREAM_ENABLED=true
ANALYTICS_AI_ENABLED=true
ANALYTICS_RETENTION_RAW_DAYS=7
ANALYTICS_RETENTION_AGGREGATED_DAYS=365
ANALYTICS_AGGREGATION_INTERVAL_MINUTES=15

# ─── Dashboard ────────────────────────────────────────────────────────────────
DASHBOARD_ENABLED=false
DASHBOARD_PORT=3000
DASHBOARD_SESSION_SECRET=                  # Min 32 chars, random string
# Get from: https://discord.com/developers/applications → Your app → OAuth2
DISCORD_CLIENT_SECRET=
DISCORD_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
# Comma-separated Discord User IDs that always get Owner-level access
DASHBOARD_ALLOWED_USER_IDS=
# Comma-separated Discord Role IDs for Admin-level access
DASHBOARD_ADMIN_ROLE_IDS=
# Comma-separated Discord Role IDs for Moderator-level access
DASHBOARD_MOD_ROLE_IDS=
```

- [ ] **Step 4: Verify build still compiles**

```
cd C:\Users\Administrator\Desktop\sectorbot
npm run build
```

Expected: No errors. If `requireEnv` throws at startup about missing vars, that's fine — the required vars are already in `.env`.

- [ ] **Step 5: Commit**

```
git add src/config/env.ts .env.example
git commit -m "feat(analytics): add analytics + dashboard env vars"
```

---

### Task 2: Create Analytics Schema

**Files:**
- Create: `src/analytics/analytics.schema.ts`

- [ ] **Step 1: Create the file**

Create `src/analytics/analytics.schema.ts`:

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

```
npm run build
```

Expected: No errors (schema file has no runtime imports, pure string exports).

- [ ] **Step 3: Commit**

```
git add src/analytics/analytics.schema.ts
git commit -m "feat(analytics): add analytics database schema"
```

---

### Task 3: Initialize Analytics Tables in DB

**Files:**
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add imports to db/index.ts**

At the top of `src/db/index.ts`, after the existing schema import, add:

```typescript
import {
  CREATE_SERVER_STATUS_HISTORY,
  CREATE_DISCORD_MESSAGE_ACTIVITY,
  CREATE_VOICE_SESSION_TEMP,
  CREATE_DISCORD_VOICE_ACTIVITY,
  CREATE_BOT_INTERACTION_EVENTS,
  CREATE_AI_USAGE_EVENTS,
  CREATE_MEMBER_EVENTS,
  CREATE_DASHBOARD_AUDIT_LOGS,
} from '../analytics/analytics.schema';
```

- [ ] **Step 2: Add initAnalyticsDb() function**

After the `getDb()` function in `src/db/index.ts`, add:

```typescript
export function initAnalyticsDb(): void {
  const database = getDb();
  database.exec(CREATE_SERVER_STATUS_HISTORY);
  database.exec(CREATE_DISCORD_MESSAGE_ACTIVITY);
  database.exec(CREATE_VOICE_SESSION_TEMP);
  database.exec(CREATE_DISCORD_VOICE_ACTIVITY);
  database.exec(CREATE_BOT_INTERACTION_EVENTS);
  database.exec(CREATE_AI_USAGE_EVENTS);
  database.exec(CREATE_MEMBER_EVENTS);
  database.exec(CREATE_DASHBOARD_AUDIT_LOGS);
}
```

- [ ] **Step 3: Call initAnalyticsDb() inside initDb()**

Inside `initDb()`, at the very end (after the last `db.exec(CREATE_STREAM_LIVE_STATES_TABLE)` and `msg_dedup` table), add:

```typescript
  initAnalyticsDb();
```

The end of `initDb()` should now look like:

```typescript
  db.exec(CREATE_STREAMER_CONFIG_TABLE);
  db.exec(CREATE_STREAMERS_TABLE);
  db.exec(CREATE_STREAM_LIVE_STATES_TABLE);
  db.exec(`CREATE TABLE IF NOT EXISTS msg_dedup (id TEXT PRIMARY KEY, ts INTEGER NOT NULL)`);
  initAnalyticsDb();
  if (path !== ':memory:') logger.info(`Datenbank initialisiert: ${path}`);
```

- [ ] **Step 4: Verify build and that tables are created**

```
npm run build
node -e "
  require('dotenv').config();
  const { initDb, getDb } = require('./dist/db/index.js');
  initDb('./data/bot.db');
  const tables = getDb().prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
  console.log(tables.map(t => t.name).join(', '));
"
```

Expected output includes: `server_status_history, discord_message_activity, voice_session_temp, discord_voice_activity, bot_interaction_events, ai_usage_events, member_events, dashboard_audit_logs`

- [ ] **Step 5: Commit**

```
git add src/db/index.ts
git commit -m "feat(analytics): initialize analytics tables in DB"
```

---

### Task 4: Create Analytics DB Write Functions

**Files:**
- Create: `src/analytics/analytics.db.ts`

- [ ] **Step 1: Create the file with write functions**

Create `src/analytics/analytics.db.ts`:

```typescript
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
  db.prepare(`DELETE FROM member_events WHERE created_at < ?`).run(cutoff - 83 * 86400); // keep 90d
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
```

- [ ] **Step 2: Verify build**

```
npm run build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/analytics/analytics.db.ts
git commit -m "feat(analytics): analytics DB write and read functions"
```

---

### Task 5: Create Analytics Tracker (Discord Event Listeners)

**Files:**
- Create: `src/analytics/analytics.tracker.ts`
- Create: `src/analytics/index.ts`

- [ ] **Step 1: Create analytics.tracker.ts**

Create `src/analytics/analytics.tracker.ts`:

```typescript
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
          if (wasStreaming) trackStreamStop(guildId, userId);
          trackVoiceLeave(guildId, userId);

        } else if (!wasInChannel && isInChannel) {
          // Joined voice
          const channelId = newState.channelId!;
          const categoryId = newState.channel?.parentId ?? null;
          trackVoiceJoin(guildId, channelId, categoryId, userId);
          if (isStreaming) trackStreamStart(guildId, userId);

        } else if (wasInChannel && isInChannel && oldState.channelId !== newState.channelId) {
          // Moved channels — treat as leave old + join new
          if (wasStreaming) trackStreamStop(guildId, userId);
          trackVoiceLeave(guildId, userId);
          const channelId = newState.channelId!;
          const categoryId = newState.channel?.parentId ?? null;
          trackVoiceJoin(guildId, channelId, categoryId, userId);
          if (isStreaming) trackStreamStart(guildId, userId);

        } else if (wasInChannel && isInChannel) {
          // Same channel — check stream state change
          if (!wasStreaming && isStreaming) trackStreamStart(guildId, userId);
          else if (wasStreaming && !isStreaming) trackStreamStop(guildId, userId);
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
```

- [ ] **Step 2: Create analytics/index.ts**

Create `src/analytics/index.ts`:

```typescript
// src/analytics/index.ts
export { setupAnalyticsTracking } from './analytics.tracker';
export { setupAggregator } from './analytics.aggregator';
export { trackAiEvent, trackInteractionEvent, insertServerStatusHistory, insertAuditLog } from './analytics.db';
export type { AiEventData, InteractionEventData, AuditLogData } from './analytics.db';
```

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/analytics/analytics.tracker.ts src/analytics/index.ts
git commit -m "feat(analytics): Discord event tracker for messages, voice, and members"
```

---

### Task 6: Create Aggregation / Retention Job

**Files:**
- Create: `src/analytics/analytics.aggregator.ts`

- [ ] **Step 1: Create the file**

Create `src/analytics/analytics.aggregator.ts`:

```typescript
// src/analytics/analytics.aggregator.ts
// Runs every ANALYTICS_AGGREGATION_INTERVAL_MIN minutes.
// Responsibilities:
// 1. Purge raw event rows older than retention window
// 2. Close stale voice sessions (bot-restart recovery)
// 3. Purge old server_status_history rows

import { env } from '../config/env';
import { logger } from '../utils/logger';
import { purgeOldRawEvents, purgeOldStatusHistory, closeStaleVoiceSessions } from './analytics.db';

let aggregatorInterval: ReturnType<typeof setInterval> | null = null;

function runAggregation(): void {
  try {
    closeStaleVoiceSessions();
    purgeOldRawEvents(env.ANALYTICS_RETENTION_RAW_DAYS);
    purgeOldStatusHistory(env.ANALYTICS_RETENTION_AGGREGATED_DAYS);
    logger.debug('[analytics] Aggregation/Cleanup-Lauf abgeschlossen.');
  } catch (err) {
    logger.warn('[analytics] Aggregation-Fehler:', err);
  }
}

export function setupAggregator(): void {
  if (!env.ANALYTICS_ENABLED) return;

  // Run immediately at startup to recover from any missed sessions
  runAggregation();

  const intervalMs = env.ANALYTICS_AGGREGATION_INTERVAL_MIN * 60 * 1000;
  aggregatorInterval = setInterval(runAggregation, intervalMs);
  logger.info(`[analytics] Aggregator läuft alle ${env.ANALYTICS_AGGREGATION_INTERVAL_MIN} Minuten.`);
}

export function stopAggregator(): void {
  if (aggregatorInterval) {
    clearInterval(aggregatorInterval);
    aggregatorInterval = null;
  }
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/analytics/analytics.aggregator.ts
git commit -m "feat(analytics): retention and cleanup aggregator job"
```

---

### Task 7: Add Logger Ring Buffer

**Files:**
- Modify: `src/utils/logger.ts`

The log SSE endpoint in Sub-project B reads recent log entries. The logger needs to maintain a ring buffer.

- [ ] **Step 1: Read current logger.ts**

Current content already known (simple console.info/warn/error wrapper).

- [ ] **Step 2: Replace logger.ts**

Replace the entire file `src/utils/logger.ts`:

```typescript
import { inspect } from 'util';

type Level = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  ts:      string;
  level:   Level;
  message: string;
}

// In-memory ring buffer — last 500 entries. Used by the dashboard log stream.
const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 500;

function pushToBuffer(level: Level, message: string): void {
  LOG_BUFFER.push({ ts: new Date().toISOString(), level, message });
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

/** Returns a snapshot of current log buffer (safe to iterate). */
export function getLogBuffer(): LogEntry[] {
  return [...LOG_BUFFER];
}

function format(level: Level, ...args: unknown[]): string {
  const ts    = new Date().toISOString();
  const parts = args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: 3 })));
  return `[${ts}] [${level.toUpperCase()}] ${parts.join(' ')}`;
}

export const logger = {
  info: (...args: unknown[]) => {
    const msg = format('info', ...args);
    console.info(msg);
    pushToBuffer('info', msg);
  },
  warn: (...args: unknown[]) => {
    const msg = format('warn', ...args);
    console.warn(msg);
    pushToBuffer('warn', msg);
  },
  error: (...args: unknown[]) => {
    const msg = format('error', ...args);
    console.error(msg);
    pushToBuffer('error', msg);
  },
  debug: (...args: unknown[]) => {
    const msg = format('debug', ...args);
    console.debug(msg);
    pushToBuffer('debug', msg);
  },
};
```

- [ ] **Step 3: Verify build**

```
npm run build
```

Expected: No errors. Existing code that imports `{ logger }` is unaffected (same API).

- [ ] **Step 4: Commit**

```
git add src/utils/logger.ts
git commit -m "feat(analytics): add log ring buffer for dashboard log streaming"
```

---

### Task 8: Track Server Status History

**Files:**
- Modify: `src/features/scumStatus/scumStatus.updater.ts`

- [ ] **Step 1: Add import**

At the top of `src/features/scumStatus/scumStatus.updater.ts`, add after the existing imports:

```typescript
import { insertServerStatusHistory } from '../../analytics/analytics.db';
import { env } from '../../config/env';
```

- [ ] **Step 2: Call insertServerStatusHistory after queryServer()**

Find the `updateDashboard` function. After `const result = await queryServer(config.host, config.query_port);`, add:

```typescript
    // Record to analytics history
    if (env.ANALYTICS_ENABLED) {
      if (result.online) {
        insertServerStatusHistory(guildId, true, result.players, result.maxPlayers, result.ping, null);
      } else {
        insertServerStatusHistory(guildId, false, null, null, null, null);
      }
    }
```

The relevant section of `updateDashboard` should now look like:

```typescript
    const result = await queryServer(config.host, config.query_port);

    // Record to analytics history
    if (env.ANALYTICS_ENABLED) {
      if (result.online) {
        insertServerStatusHistory(guildId, true, result.players, result.maxPlayers, result.ping, null);
      } else {
        insertServerStatusHistory(guildId, false, null, null, null, null);
      }
    }

    const embed  = buildStatusEmbed(result, config.host, config.query_port);
```

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/features/scumStatus/scumStatus.updater.ts
git commit -m "feat(analytics): record server status history on each SCUM check"
```

---

### Task 9: Track AI Events in OldManLore

**Files:**
- Modify: `src/features/oldManLore.ts`

- [ ] **Step 1: Add import at top of oldManLore.ts**

Add after existing imports:

```typescript
import { trackAiEvent } from '../analytics/analytics.db';
import { env } from '../config/env';
```

- [ ] **Step 2: Wrap askGroq with timing + tracking**

Find the `askGroq` function call inside the main handler (the part that calls `askGroq(messages)` and awaits it). It looks approximately like:

```typescript
  let reply = await askGroq(messages);
```

Replace that single call with:

```typescript
  const t0Groq = Date.now();
  let reply: string;
  try {
    reply = await askGroq(messages);
    if (env.ANALYTICS_AI_ENABLED) {
      trackAiEvent({ guildId: message.guildId ?? 'unknown', provider: 'groq', model: 'llama-3.3-70b-versatile', feature: 'oldman', success: true, durationMs: Date.now() - t0Groq });
    }
  } catch (err) {
    if (env.ANALYTICS_AI_ENABLED) {
      trackAiEvent({ guildId: message.guildId ?? 'unknown', provider: 'groq', model: 'llama-3.3-70b-versatile', feature: 'oldman', success: false, error: String(err), durationMs: Date.now() - t0Groq });
    }
    throw err;
  }
```

> Note: The exact location depends on the current file structure. Find the `askGroq(messages)` call (there may be a retry path too). Add timing + tracking around both the initial call and the retry call. Use the same pattern for `askOllama` if applicable (provider: 'ollama').

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/features/oldManLore.ts
git commit -m "feat(analytics): track AI usage events from OldManLore (Groq)"
```

---

### Task 10: Track Bot Interactions in client.ts

**Files:**
- Modify: `src/client.ts`

- [ ] **Step 1: Read client.ts to understand the interaction dispatch**

```
Read: src/client.ts
```

- [ ] **Step 2: Add import**

Add to the top of `src/client.ts`:

```typescript
import { trackInteractionEvent } from './analytics/analytics.db';
import { env } from './config/env';
```

- [ ] **Step 3: Wrap the slash command handler**

Find the `interactionCreate` listener section that handles `ChatInputCommandInteraction` (where `commands.get(interaction.commandName)` is called). Wrap the execute call with timing:

Before (approximate pattern — adapt to exact code):
```typescript
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command-Fehler: ${err}`);
    }
```

After:
```typescript
    const command = commands.get(interaction.commandName);
    if (!command) return;
    const t0 = Date.now();
    let cmdSuccess = true;
    try {
      await command.execute(interaction);
    } catch (err) {
      cmdSuccess = false;
      logger.error(`Command-Fehler: ${err}`);
    } finally {
      if (env.ANALYTICS_ENABLED && interaction.guildId) {
        try {
          trackInteractionEvent({
            guildId: interaction.guildId,
            interactionType: 'command',
            commandName: interaction.commandName,
            feature: interaction.commandName,
            success: cmdSuccess,
            durationMs: Date.now() - t0,
            errorType: cmdSuccess ? null : 'execution_error',
          });
        } catch { /* never let analytics crash the bot */ }
      }
    }
```

- [ ] **Step 4: Verify build**

```
npm run build
```

- [ ] **Step 5: Commit**

```
git add src/client.ts
git commit -m "feat(analytics): track bot command interactions with timing"
```

---

### Task 11: Wire Analytics into index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports**

Add to the top of `src/index.ts`, after the existing imports:

```typescript
import { setupAnalyticsTracking, setupAggregator } from './analytics/index';
```

- [ ] **Step 2: Call setup functions**

Near the bottom of `src/index.ts`, before `client.login(env.DISCORD_TOKEN)`, add:

```typescript
if (env.ANALYTICS_ENABLED) {
  setupAnalyticsTracking(client);
  setupAggregator();
}
```

- [ ] **Step 3: Final build + restart**

```
npm run build
pm2 restart scum-bot
```

- [ ] **Step 4: Verify analytics tables are getting data**

Wait 60 seconds, then run:

```
node -e "
  require('dotenv').config();
  const { initDb, getDb } = require('./dist/db/index.js');
  initDb('./data/bot.db');
  const db = getDb();
  console.log('server_status_history:', db.prepare('SELECT COUNT(*) AS n FROM server_status_history').get());
  console.log('member_events:', db.prepare('SELECT COUNT(*) AS n FROM member_events').get());
  console.log('bot_interaction_events:', db.prepare('SELECT COUNT(*) AS n FROM bot_interaction_events').get());
"
```

Expected: `server_status_history` count increases over time. `member_events` increments on joins/leaves. `bot_interaction_events` increments on slash command usage.

- [ ] **Step 5: Commit**

```
git add src/index.ts
git commit -m "feat(analytics): wire analytics tracking and aggregator into bot startup"
```

---

## Self-Review Checklist

- [x] Spec section 3.2 (message analytics): `trackMessage()` + `discord_message_activity` table + read functions ✅
- [x] Spec section 3.3 (voice analytics): `voice_session_temp` + `discord_voice_activity` + join/leave/move logic ✅
- [x] Spec section 3.4 (stream analytics): `trackStreamStart/Stop()` + `total_stream_seconds` column ✅
- [x] Spec section 3.9 (growth): `member_events` + `getMemberEventsByDay()` ✅
- [x] Spec section 3.11 (bot usage): `bot_interaction_events` + command timing ✅
- [x] Spec section 3.12 (AI analytics): `ai_usage_events` + `trackAiEvent()` ✅
- [x] Spec section 3.13 (server status): `server_status_history` + `insertServerStatusHistory()` ✅
- [x] Spec section 3.15 (privacy): No message content stored, no user IDs in aggregated tables, `voice_session_temp` not exposed via API ✅
- [x] Spec section 6 (audit logs): `dashboard_audit_logs` + `insertAuditLog()` with secret masking ✅
- [x] Log ring buffer for Sub-project B log streaming ✅
- [x] Aggregator/cleanup job ✅
- [x] ENV vars documented in `.env.example` ✅
