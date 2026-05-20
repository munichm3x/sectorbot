# Sector 13 Web Dashboard — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add a professional, dark-themed web dashboard to the existing Discord bot that provides real analytics, ticket management, server status monitoring, settings management, and audit logging — without breaking any existing bot functionality.

**Architecture:** Three-layer system: (A) analytics event tracking inside the bot, (B) Express.js dashboard server with Discord OAuth2 auth and REST API, (C) server-rendered HTML frontend with vanilla JS and Chart.js for visualization.

**Tech Stack:** TypeScript, Express.js (new), express-session, connect-sqlite3, better-sqlite3 (existing), Discord OAuth2 (custom), Chart.js (CDN), Tailwind CSS (CDN in dev / inline custom CSS in prod), Discord.js v14 (existing).

---

## 1. Scope — Three Sub-Projects

This spec covers Phase 1 in three sequential sub-projects, each delivered independently:

### Sub-project A: Analytics Infrastructure
New SQLite tables + bot event hooks + aggregation job. The bot starts tracking data immediately. No UI yet.

### Sub-project B: Dashboard Server + Auth + API
Express server, Discord OAuth2 login/logout, session middleware, permission checks, all REST API routes returning JSON from the existing DB and new analytics tables.

### Sub-project C: Dashboard Frontend
HTML/CSS/JS for all pages served by the Express server: Overview, Analytics, Tickets, Server Status, Logs, Members, Settings, AI.

---

## 2. File Structure

```
src/
├── dashboard/                        ← NEW (Sub-project B+C)
│   ├── server.ts                     ← Express app factory, exports startDashboard()
│   ├── auth/
│   │   ├── discord-oauth.ts          ← OAuth2 flow (redirect, callback, token exchange)
│   │   └── middleware.ts             ← requireAuth(), requirePermission() middleware
│   ├── routes/
│   │   ├── auth.routes.ts            ← GET /auth/login, /auth/callback, /auth/logout
│   │   ├── api/
│   │   │   ├── overview.routes.ts    ← GET /api/overview
│   │   │   ├── analytics.routes.ts   ← GET /api/analytics/*
│   │   │   ├── tickets.routes.ts     ← GET/POST /api/tickets/*
│   │   │   ├── settings.routes.ts    ← GET/PATCH /api/settings/*
│   │   │   ├── logs.routes.ts        ← GET /api/logs, /api/audit-logs
│   │   │   ├── members.routes.ts     ← GET /api/members
│   │   │   └── server-status.routes.ts ← GET/POST /api/server-status/*
│   │   └── pages.routes.ts           ← Serves index.html for all non-API routes
│   └── public/                       ← NEW (Sub-project C)
│       ├── index.html                ← SPA shell with sidebar + main area
│       ├── css/
│       │   └── dashboard.css         ← Full dark theme, no CDN dependency
│       └── js/
│           ├── app.js                ← Router, auth check, nav, global utilities
│           ├── api.js                ← fetch() wrappers for all API routes
│           ├── charts.js             ← Chart.js configuration defaults
│           └── pages/
│               ├── overview.js
│               ├── analytics.js
│               ├── tickets.js
│               ├── server-status.js
│               ├── members.js
│               ├── logs.js
│               ├── settings.js
│               └── ai.js
├── analytics/                        ← NEW (Sub-project A)
│   ├── analytics.db.ts               ← All analytics DB queries (read + write)
│   ├── analytics.schema.ts           ← CREATE TABLE statements for new tables
│   ├── analytics.tracker.ts          ← trackMessage(), trackVoice(), trackCommand(), trackAI()
│   └── analytics.aggregator.ts      ← Hourly aggregation job
└── index.ts                          ← MODIFIED: conditionally starts dashboard
```

---

## 3. New Dependencies

```json
"express": "^4.19.0",
"express-session": "^1.18.0",
"connect-sqlite3": "^0.9.14"
```

Dev:
```json
"@types/express": "^4.17.21",
"@types/express-session": "^1.18.0",
"@types/connect-sqlite3": "^0.9.6"
```

No React, no Vite, no webpack. Chart.js loaded via CDN in the HTML.

---

## 4. New Environment Variables

Add to `.env` and `.env.example`:

```env
# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
DASHBOARD_URL=http://localhost:3000
DASHBOARD_SESSION_SECRET=change-me-in-production-minimum-32-chars

# Discord OAuth2 (create app at https://discord.com/developers/applications)
DISCORD_CLIENT_SECRET=                     # OAuth2 client secret (CLIENT_ID already in env)
DISCORD_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback

# Access control (comma-separated Discord IDs / Role IDs)
DASHBOARD_ALLOWED_USER_IDS=               # Always-allowed user IDs (e.g. bot owner)
DASHBOARD_ADMIN_ROLE_IDS=                 # Role IDs with admin access
DASHBOARD_MOD_ROLE_IDS=                   # Role IDs with moderator access (tickets, logs)

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_MESSAGE_ENABLED=true
ANALYTICS_VOICE_ENABLED=true
ANALYTICS_STREAM_ENABLED=true
ANALYTICS_AI_ENABLED=true
ANALYTICS_RETENTION_RAW_DAYS=7
ANALYTICS_RETENTION_AGGREGATED_DAYS=365
```

---

## 5. New Database Tables (Sub-project A)

All created in `analytics.schema.ts`, initialized in `initDb()`.

### 5.1 Server Status History
```sql
CREATE TABLE IF NOT EXISTS server_status_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id        TEXT    NOT NULL,
  online          INTEGER NOT NULL,
  players_online  INTEGER,
  max_players     INTEGER,
  ping            INTEGER,
  error           TEXT,
  checked_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ssh_guild_checked ON server_status_history(guild_id, checked_at);
```

### 5.2 Discord Message Activity (bucketed)
```sql
CREATE TABLE IF NOT EXISTS discord_message_activity (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id         TEXT    NOT NULL,
  channel_id       TEXT    NOT NULL,
  category_id      TEXT,
  bucket_start     INTEGER NOT NULL,
  bucket_type      TEXT    NOT NULL, -- 'hour' | 'day'
  message_count    INTEGER NOT NULL DEFAULT 0,
  unique_user_count INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_bucket ON discord_message_activity(guild_id, channel_id, bucket_start, bucket_type);
CREATE INDEX IF NOT EXISTS idx_dma_guild_bucket ON discord_message_activity(guild_id, bucket_start, bucket_type);
```

### 5.3 Voice Session Temp (active sessions, cleared after aggregation)
```sql
CREATE TABLE IF NOT EXISTS voice_session_temp (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id          TEXT    NOT NULL,
  channel_id        TEXT    NOT NULL,
  category_id       TEXT,
  user_id           TEXT    NOT NULL,  -- needed to match JOIN/LEAVE; NOT shown in dashboard
  joined_at         INTEGER NOT NULL,
  stream_started_at INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vst_user ON voice_session_temp(guild_id, user_id);
```

### 5.4 Discord Voice Activity (bucketed)
```sql
CREATE TABLE IF NOT EXISTS discord_voice_activity (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id              TEXT    NOT NULL,
  channel_id            TEXT    NOT NULL,
  category_id           TEXT,
  bucket_start          INTEGER NOT NULL,
  bucket_type           TEXT    NOT NULL,
  session_count         INTEGER NOT NULL DEFAULT 0,
  total_seconds         INTEGER NOT NULL DEFAULT 0,
  stream_session_count  INTEGER NOT NULL DEFAULT 0,
  total_stream_seconds  INTEGER NOT NULL DEFAULT 0,
  max_concurrent_users  INTEGER,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dva_bucket ON discord_voice_activity(guild_id, channel_id, bucket_start, bucket_type);
CREATE INDEX IF NOT EXISTS idx_dva_guild_bucket ON discord_voice_activity(guild_id, bucket_start, bucket_type);
```

### 5.5 Bot Interaction Events (raw, retained ANALYTICS_RETENTION_RAW_DAYS)
```sql
CREATE TABLE IF NOT EXISTS bot_interaction_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id         TEXT    NOT NULL,
  interaction_type TEXT    NOT NULL, -- 'command' | 'button' | 'select' | 'modal'
  command_name     TEXT,
  component_id     TEXT,
  feature          TEXT    NOT NULL,
  success          INTEGER NOT NULL DEFAULT 1,
  duration_ms      INTEGER,
  error_type       TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_bie_guild_created ON bot_interaction_events(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bie_command ON bot_interaction_events(guild_id, command_name, created_at);
```

### 5.6 AI Usage Events (raw)
```sql
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id        TEXT    NOT NULL,
  provider        TEXT    NOT NULL, -- 'groq' | 'ollama' | 'openai'
  model           TEXT,
  feature         TEXT    NOT NULL, -- 'oldman' | 'ticket_summary' | 'changelog'
  success         INTEGER NOT NULL DEFAULT 1,
  error           TEXT,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  duration_ms     INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_aue_guild_created ON ai_usage_events(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aue_feature ON ai_usage_events(guild_id, feature, created_at);
```

### 5.7 Member Events (growth tracking)
```sql
CREATE TABLE IF NOT EXISTS member_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT    NOT NULL,
  event_type  TEXT    NOT NULL, -- 'join' | 'leave'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_me_guild_created ON member_events(guild_id, created_at);
```

### 5.8 Dashboard Audit Logs
```sql
CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id      TEXT    NOT NULL,
  admin_user_id TEXT    NOT NULL,
  action        TEXT    NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  old_value     TEXT,   -- JSON, secrets masked
  new_value     TEXT,   -- JSON, secrets masked
  success       INTEGER NOT NULL DEFAULT 1,
  ip_address    TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dal_guild_created ON dashboard_audit_logs(guild_id, created_at);
```

### 5.9 Dashboard Sessions (SQLite session store)
Managed automatically by `connect-sqlite3`. Table name: `dashboard_sessions`.

---

## 6. Bot Event Hooks (Sub-project A)

### 6.1 Message Tracking
Add listener in `src/analytics/analytics.tracker.ts`:
```typescript
// messageCreate: increment bucketed counter, NO content stored
client.on('messageCreate', (msg) => {
  if (msg.author.bot || !msg.guild) return;
  trackMessageEvent(msg.guild.id, msg.channelId, msg.channel.parentId ?? null);
});
```
`trackMessageEvent` does an `INSERT ... ON CONFLICT DO UPDATE SET message_count = message_count + 1` against the current hour bucket.

### 6.2 Voice/Stream Tracking
```typescript
client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = newState.guild.id;
  // Join: upsert voice_session_temp
  // Leave: compute duration, write to discord_voice_activity bucket, delete from temp
  // Stream start: update stream_started_at in temp
  // Stream stop: compute stream duration, update voice bucket
});
```

### 6.3 Member Growth
```typescript
client.on('guildMemberAdd',    (m) => trackMemberEvent(m.guild.id, 'join'));
client.on('guildMemberRemove', (m) => trackMemberEvent(m.guild.id, 'leave'));
```

### 6.4 Command Tracking
Wrap the existing command dispatch in `client.ts` to record every interaction into `bot_interaction_events` with timing and success/failure.

### 6.5 AI Tracking
Expose `trackAiEvent()` from `analytics.tracker.ts`. Call it from `oldManLore.ts` after each Groq/Ollama call.

### 6.6 Server Status History
In `scumStatus.updater.ts`, after each `queryServer()` call, insert a row into `server_status_history`.

---

## 7. Aggregation Job (Sub-project A)

`analytics.aggregator.ts` runs every 15 minutes (configurable via `ANALYTICS_AGGREGATION_INTERVAL_MINUTES`):
- Reads `bot_interaction_events` older than the current hour and produces `bot_interaction_analytics` buckets (not implemented in Phase 1 for simplicity — raw events are queried directly)
- Purges `server_status_history` older than `ANALYTICS_RETENTION_AGGREGATED_DAYS` days
- Purges `bot_interaction_events` older than `ANALYTICS_RETENTION_RAW_DAYS` days
- Purges `ai_usage_events` older than `ANALYTICS_RETENTION_RAW_DAYS` days
- Purges `member_events` older than 90 days
- Closes stale `voice_session_temp` entries (user offline for >4 hours)

---

## 8. Dashboard Server (Sub-project B)

### 8.1 Entry Point Integration
`src/index.ts` gains:
```typescript
if (env.DASHBOARD_ENABLED) {
  const { startDashboard } = await import('./dashboard/server');
  startDashboard(client);
}
```

### 8.2 Express App Structure
`src/dashboard/server.ts`:
```typescript
export function startDashboard(discordClient: Client): void {
  const app = express();
  app.use(json());
  app.use(session({ store: sqliteStore, secret, resave: false, saveUninitialized: false }));
  app.use('/auth', authRouter);
  app.use('/api', requireAuth, apiRouter);
  app.use(express.static('src/dashboard/public'));
  app.get('*', (req, res) => res.sendFile('index.html', { root: 'src/dashboard/public' }));
  app.listen(env.DASHBOARD_PORT);
}
```

### 8.3 Discord OAuth2 Flow

**Login:** `GET /auth/login` → redirects to `https://discord.com/api/oauth2/authorize?...`

Scopes needed: `identify guilds.members.read`

**Callback:** `GET /auth/callback`
1. Exchange code for access token (POST to Discord token endpoint)
2. Fetch user info (`GET /api/users/@me`)
3. Fetch guild member info (`GET /api/users/@me/guilds/{guild_id}/member`)
4. Check permissions:
   - Is user ID in `DASHBOARD_ALLOWED_USER_IDS`? → Owner
   - Does user have a role in `DASHBOARD_ADMIN_ROLE_IDS`? → Admin
   - Does user have a role in `DASHBOARD_MOD_ROLE_IDS`? → Moderator
   - Otherwise: 403, redirect to `/auth/denied`
5. Store `{ userId, username, avatar, permissionLevel }` in session

**Logout:** `GET /auth/logout` → destroy session, redirect to `/auth/login`

### 8.4 Permission Levels
```typescript
enum PermLevel { Owner = 4, Admin = 3, Moderator = 2, Viewer = 1 }
```

| Route | Min Level |
|---|---|
| GET /api/overview | Viewer |
| GET /api/analytics/* | Viewer |
| GET /api/tickets | Moderator |
| GET /api/tickets/:id | Moderator |
| GET /api/members | Moderator |
| GET /api/logs | Moderator |
| GET /api/audit-logs | Admin |
| GET /api/settings | Admin |
| PATCH /api/settings/* | Admin |
| POST /api/server-status/test | Admin |
| DELETE /api/tickets/:id/* | Admin |

### 8.5 API Routes

All return `{ success: true, data: ... }` or `{ success: false, error: "..." }`.

#### Overview
- `GET /api/overview` → bot uptime, guild count, open tickets, server status snapshot, member count, 24h metrics

#### Analytics
- `GET /api/analytics/messages?period=7d&guildId=` → message counts per channel/day
- `GET /api/analytics/voice?period=7d&guildId=` → voice time per channel/day
- `GET /api/analytics/tickets?period=30d&guildId=` → ticket volume, avg resolution time, by category
- `GET /api/analytics/commands?period=7d&guildId=` → command usage counts
- `GET /api/analytics/ai?period=7d&guildId=` → AI requests by feature/provider
- `GET /api/analytics/growth?period=30d&guildId=` → join/leave events over time
- `GET /api/analytics/server-status?period=7d&guildId=` → status history with player counts

#### Tickets
- `GET /api/tickets?status=open|closed&page=1&limit=25&search=` → paginated ticket list
- `GET /api/tickets/:id` → ticket detail

#### Logs
- `GET /api/logs?level=&category=&limit=25` → recent operational logs (from in-memory ring buffer)
- `GET /api/audit-logs?limit=50` → dashboard audit trail

#### Members
- `GET /api/members?guild=` → guild member list (fetched live from Discord API via bot client)

#### Settings
- `GET /api/settings` → all config (secrets masked: shown as `"••••••••"`)
- `PATCH /api/settings/guild` → upsert guild_config
- `PATCH /api/settings/scum-status` → upsert scum_status_config (secret fields only written if non-empty)
- `PATCH /api/settings/streamer` → upsert streamer_config

#### Server Status Actions
- `POST /api/server-status/test` → runs queryServer() immediately, returns result
- `GET /api/me` → current logged-in user info from session

---

## 9. Frontend Design (Sub-project C)

### 9.1 Visual Direction
- Background: `#0a0a0c` (near-black)
- Surface: `#111115` (cards)
- Border: `#1e1e24` (subtle)
- Primary accent: `#8B0000` (SECTOR_RED)
- Success: `#3E5F3E` (MILITARY_GREEN)
- Warning: `#B36B00` (WARNING_AMBER)
- Danger: `#ED4245` (OFFLINE_RED)
- Text primary: `#e8e8ee`
- Text secondary: `#9090a0`
- Font: `'JetBrains Mono', 'Fira Code', monospace` for values; `system-ui, sans-serif` for labels

### 9.2 Layout
```
┌─ Sidebar (240px fixed) ─┬─── Main Area ───────────────────────────────┐
│ [SECTOR 13 logo]         │ ┌── Topbar ───────────────────────────────┐ │
│                          │ │ Page Title              [Avatar] [Logout]│ │
│ Navigation:              │ └─────────────────────────────────────────┘ │
│ • Overview               │                                             │
│ • Analytics ▼            │  Page Content                               │
│   · Messages             │                                             │
│   · Voice                │                                             │
│   · Tickets              │                                             │
│   · Commands             │                                             │
│   · AI Usage             │                                             │
│   · Growth               │                                             │
│   · Server Status        │                                             │
│ • Tickets                │                                             │
│ • Members                │                                             │
│ • Server Status          │                                             │
│ • Logs                   │                                             │
│ • Settings               │                                             │
│                          │                                             │
│ [Bot status indicator]   │                                             │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### 9.3 Pages

**Overview** — KPI cards (open tickets, server online/offline, members, AI requests 24h), mini charts (last 24h messages, server player count), recent audit log entries, quick-action buttons.

**Analytics: Messages** — Line chart (messages/day over period), bar chart (top 10 channels by messages), heatmap (hour × weekday activity), KPI cards (total, today, peak channel).

**Analytics: Voice** — Line chart (voice-hours/day), bar chart (top channels by voice time), KPI cards (total hours, sessions, avg session length).

**Analytics: Tickets** — Line chart (tickets opened/closed per day), donut chart (by category), KPI cards (open, avg resolution time, closed this week), table of recent tickets.

**Analytics: Commands** — Bar chart (top 15 commands), line chart (usage over time), error rate per command, KPI cards.

**Analytics: AI Usage** — KPI cards (requests today/7d/30d, success rate), bar chart by feature, line chart over time, error summary.

**Analytics: Growth** — Line chart (members join/leave over period), net-growth area chart, KPI cards (total members, net 7d, net 30d).

**Analytics: Server Status** — Line chart (player count over time), online-fraction donut, KPI cards (uptime %, peak players, avg players), failure log table.

**Tickets** — Filterable table (open/closed/all, search by user/category/summary), detail modal showing summary + metadata.

**Members** — Live table fetched from Discord API via bot client (username, roles, join date, ticket count). Filter by team/role. No activity metrics per user.

**Server Status** — Current status card, player-count sparkline, uptime bar, last 50 check history, "Test Now" button.

**Logs** — Filterable log viewer (level, category, time range), real-time tail via SSE (Server-Sent Events) on `/api/logs/stream`.

**Settings** — Accordion sections (General, Ticket System, Server Status, Streamer, AI, Analytics, Design). All secret inputs show `••••••••` and only submit if changed. Save → PATCH → audit log entry.

**AI** — Active provider/model display, feature toggles, last 50 AI events table (no prompt contents), aggregated metrics.

### 9.4 Reusable JS Components
- `StatCard(title, value, delta, unit)` — renders a metric card
- `LineChart(canvasId, labels, datasets)` — Chart.js line wrapper
- `BarChart(canvasId, labels, values)` — Chart.js bar wrapper
- `DonutChart(canvasId, labels, values)` — Chart.js donut wrapper
- `DataTable(containerId, columns, rows, options)` — sortable/filterable table
- `EmptyState(message)` — "No data yet" card
- `LoadingState()` — skeleton card
- `Toast(message, level)` — top-right notification

---

## 10. Discord Intents Required

The existing bot already uses `GatewayIntentBits.Guilds`, `GuildMessages`, `MessageContent`, `GuildVoiceStates`, and `GuildMembers`. No new intents are required:

| Intent | Purpose | Already Present |
|---|---|---|
| Guilds | Channel/category metadata | Yes |
| GuildMessages | messageCreate counting (no content read) | Yes |
| GuildVoiceStates | voiceStateUpdate for voice/stream tracking | Yes |
| GuildMembers | guildMemberAdd/Remove, member list | Yes |

> Note: `MessageContent` intent IS already enabled (for the OldManLore feature). Message analytics only count messages — no content is stored or read for analytics purposes.

---

## 11. Privacy Rules (enforced in code)

1. `discord_message_activity` stores only `guild_id, channel_id, message_count`. No user identifiers in message buckets.
2. `voice_session_temp` stores `user_id` (needed to match join/leave) but this table is **never exposed via any API route or dashboard view**.
3. `discord_voice_activity` aggregated buckets contain no user identifiers.
4. `member_events` stores only `guild_id, event_type, created_at` (counts of joins/leaves, no user IDs).
5. No message content is stored for analytics anywhere.
6. API route `GET /api/members` fetches live from Discord via the bot's guild cache — it shows user info for management purposes (roles, join date), not activity rankings.
7. No per-user activity rankings, message counts, voice hours, or stream time are exposed in any API response or dashboard view.
8. AI event logs do not store prompt contents — only `feature`, `provider`, `model`, `success`, `duration_ms`, `tokens_in/out`.
9. Dashboard audit logs mask secret values: any key containing `secret`, `key`, `token`, or `password` is stored as `"[REDACTED]"`.

---

## 12. Security

- `requireAuth` middleware returns 401 JSON for API routes, redirects to `/auth/login` for page routes
- `requirePermission(level)` returns 403 if user session permission level < required
- All PATCH/POST body inputs validated before DB write (type checks, max length)
- Rate limiting: `/auth/*` routes limited to 10 req/min per IP using simple in-memory counter
- Session cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` when `NODE_ENV=production`
- CSRF: Not needed — API uses session cookie (sameSite=lax) + JSON-only responses
- No secrets in any API response. PATCH requests with secret fields: empty string = "keep existing", non-empty = overwrite
- Stack traces never returned to frontend — catch blocks return generic messages

---

## 13. Bot index.ts Integration

```typescript
// At bottom of index.ts, after client.login():
if (env.DASHBOARD_ENABLED) {
  import('./dashboard/server').then(({ startDashboard }) => {
    startDashboard(client);
  }).catch(err => logger.error('[dashboard] Start fehlgeschlagen:', err));
}
```

The analytics tracker is initialized earlier:
```typescript
if (env.ANALYTICS_ENABLED) {
  const { setupAnalyticsTracking } = await import('./analytics/analytics.tracker');
  setupAnalyticsTracking(client);
}
```

---

## 14. Assumptions

1. The Discord application (`CLIENT_ID`) already exists. The user must enable OAuth2 in the Discord Developer Portal, add `DISCORD_CLIENT_SECRET` to `.env`, and add the redirect URI (`DASHBOARD_OAUTH_CALLBACK_URL`) to the OAuth2 allowed redirects list.
2. Phase 1 does not implement CSV export, Health Score, or Stage/Event analytics — these are Phase 2.
3. The log viewer shows an in-memory ring buffer of the last 500 log entries (captured via a logger wrapper) — not historical logs from disk.
4. `connect-sqlite3` stores sessions in a separate SQLite file (`./data/dashboard-sessions.db`) to avoid coupling session state to the main bot DB.
5. Deployment: PM2 continues to run a single process (`dist/index.js`); the Express server runs in-process on the configured port.
6. The Members page calls Discord's API via the bot's cached guild data — it shows at most what the bot can see with its intents.
7. Role-based team analytics (Green/Red/Blue/Yellow teams) are scoped to Phase 2 since team role IDs are not yet configurable in the DB.

---

## 15. Implementation Order (Sub-project Sequence)

1. **Sub-project A** (Analytics Infrastructure) — must complete first; provides data for all dashboard pages
2. **Sub-project B** (Dashboard Server + Auth + API) — depends on A's DB tables; provides all API endpoints
3. **Sub-project C** (Dashboard Frontend) — depends on B's API; delivers the visual UI

Each sub-project is independently testable:
- A: Verify tables exist, verify events are written on bot activity
- B: Test API routes with curl/Postman after login
- C: Open browser, navigate all pages, verify empty states display correctly before data arrives
