# sectorbot — Architecture

## Overview

sectorbot is a Discord.js v14 bot with an optional Express-based admin dashboard. It is written in TypeScript and uses SQLite (via `better-sqlite3`) as its database.

---

## Startup Process

```
src/index.ts
│
├── registerErrorHandlers(ctx)   ← global process error handlers first
├── initDb(env.DATABASE_PATH)    ← SQLite opened/migrated before any feature runs
├── registerCommands(ctx)        ← populate commands Collection
├── registerInteractions(ctx)    ← populate all interaction handler Maps
├── registerFeatures(ctx)        ← event-driven features (listeners registered)
├── registerScheduledJobs(ctx)   ← polling features (intervals started)
├── registerAnalytics(ctx)       ← optional: tracking + aggregator
├── registerDashboard(ctx)       ← optional: dashboard starts on 'ready'
│
├── client.once('ready', ...)    ← log bot tag + handler counts
└── client.login(token)          ← connect to Discord Gateway
```

All registration happens synchronously before `client.login()`. Non-critical modules (`registerFeatures`, `registerScheduledJobs`, `registerAnalytics`) wrap each setup call individually — a failure in one does not abort the others.

---

## Bootstrap Modules (`src/bootstrap/`)

| File | Responsibility |
|------|---------------|
| `context.ts` | `BootstrapContext` interface — shared DI contract |
| `registerCommands.ts` | Register all 15 slash commands into `ctx.commands` |
| `registerInteractions.ts` | Register all button/modal/select handlers into their Maps |
| `registerFeatures.ts` | Start event-driven features |
| `registerScheduledJobs.ts` | Start polling/interval features |
| `registerAnalytics.ts` | Start analytics if `ANALYTICS_ENABLED=true` |
| `registerDashboard.ts` | Schedule dashboard start if `DASHBOARD_ENABLED=true` |
| `registerErrorHandlers.ts` | Register `uncaughtException`, `unhandledRejection`, `SIGTERM` |

### BootstrapContext

```ts
interface BootstrapContext {
  client:                Client;               // Discord.js Client
  commands:              Collection<string, Command>;
  buttonHandlers:        Map<string, ButtonHandler>;
  selectMenuHandlers:    Map<string, SelectMenuHandler>;
  channelSelectHandlers: Map<string, ChannelSelectMenuHandler>;
  roleSelectHandlers:    Map<string, RoleSelectMenuHandler>;
  modalHandlers:         Map<string, ModalHandler>;
  userSelectHandlers:    Map<string, UserSelectMenuHandler>;
  env:                   { ANALYTICS_ENABLED: boolean; DASHBOARD_ENABLED: boolean; ... };
  logger:                { info, warn, error, debug };
}
```

The context object is assembled once in `src/index.ts` from the exports of `src/client.ts`, `src/config/env.ts`, and `src/utils/logger.ts`. Bootstrap functions never import from `client.ts` directly — they operate on what they're given.

---

## Interaction Dispatch (`src/client.ts`)

`src/client.ts` creates the Discord client, exports all handler `Collection`/`Map` objects, and wires up the `interactionCreate` event listener. The listener:

1. Identifies the interaction type
2. Extracts `prefix` and `payload` from `customId` using `parseId()` from `src/utils/ids.ts`
3. Looks up the handler in the appropriate Map
4. Calls `handler.execute(interaction, payload)`

Command interactions have an inner try/catch for per-command error handling and analytics tracking. All other interaction types are caught by an outer try/catch safety net.

---

## Feature Modules (`src/features/`)

| Feature | Files | What it does |
|---------|-------|-------------|
| **Old Man Lore** | `oldManLore.ts` | AI-powered responses to messages matching a lore trigger, via `client.on('messageCreate')` |
| **Changelog Dashboard** | `changelogDashboard.ts` | Posts a changelog embed to a configured channel and keeps it up to date |
| **SCUM Status** | `scumStatus/` | Polls a game server via UDP, builds a status embed, updates a Discord message on an interval |
| **Streamer** | `streamer/` | Tracks Twitch/YouTube streamers, posts announcements; includes a setup wizard and dashboard UI |
| **Ticket Auto-Close** | `ticketAutoClose.ts` | Periodically checks for inactive tickets and closes them |
| **Discord Sync** | `discordSync/eventListeners.ts` | Syncs Discord scheduled events to the `public_events` DB table |

---

## Dashboard (`src/dashboard/`)

An Express 4 server started optionally when `DASHBOARD_ENABLED=true`. It is lazy-loaded on the `ready` event so the bot is fully connected before the HTTP server starts.

Key subsystems:

- **Auth**: Discord OAuth2, express-session with SQLite store, role-based permissions (`PermLevel` enum)
- **CSRF**: double-submit cookie pattern via `csrf-csrf`; token endpoint at `GET /api/csrf-token`
- **API routes** (`/api/*`): requires auth + CSRF on mutations; rate-limited 100 req/min
- **Public API** (`/public-api/*`): read-only, no auth required, returns only `public_visible=1` data
- **Admin routes**: settings, rules, events, changelog, announcements, FAQ, wipe info, server info, bot settings, ticket archive
- **Audit logs**: all mutations logged to `dashboard_audit_logs`; viewed at `GET /api/logs/audit`

---

## Database (`src/db/`)

SQLite database via `better-sqlite3`. Initialized with `initDb(path)` — supports `:memory:` for tests.

Schema is defined in `src/db/schema.ts` (bot tables) and `src/analytics/analytics.schema.ts` (analytics tables). Migrations are applied automatically on `initDb`.

Key tables:

| Table | Purpose |
|-------|---------|
| `guilds` | Per-guild bot configuration |
| `tickets` | Ticket records |
| `ticket_categories` | Configurable ticket category definitions |
| `panels` | Discord message panel references |
| `rules` | Public-facing rule entries |
| `public_events` | Events visible on the public dashboard |
| `changelog_entries` | Changelog entries with publish state |
| `public_announcements` | Announcements with display scheduling |
| `faq_items` | FAQ entries |
| `dashboard_audit_logs` | Admin action audit trail |
| `scum_status_config` | SCUM server polling configuration per guild |
| `streamer_configs` | Streamer notification configurations |

---

## Analytics (`src/analytics/`)

Optional module enabled via `ANALYTICS_ENABLED=true`.

- **`analytics.tracker.ts`**: listens to `messageCreate`, `voiceStateUpdate`, `guildScheduledEventCreate` to track activity metrics
- **`analytics.aggregator.ts`**: runs on an interval to roll up raw events into time-bucketed aggregates
- **`analytics.db.ts`**: write functions (`trackInteractionEvent`, `trackAiEvent`, `insertServerStatusHistory`, `insertAuditLog`) and `maskSecretKeys` for redacting sensitive fields before storage

---

## AI (`src/services/ai/`)

Multi-provider AI integration used by Old Man Lore and the ticket summary feature.

| Provider | Config key | Notes |
|----------|------------|-------|
| Gemini | `AI_PROVIDER=gemini`, `GEMINI_API_KEY` | Default primary |
| Groq | `AI_PROVIDER=groq`, `GROQ_API_KEY` | Fallback |
| OpenRouter | `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` | Optional |
| Ollama | Local `OLLAMA_URL` | Local fallback for Old Man Lore |

The provider is selected at startup based on `AI_PROVIDER`. If the primary provider fails, `AI_FALLBACK_PROVIDER` is tried.

---

## Scheduled Jobs

All jobs are started in `registerScheduledJobs`:

| Job | Setup function | What it does |
|-----|---------------|-------------|
| SCUM Status | `setupScumStatus(client)` | Polls game server every `update_interval_secs`, updates embed |
| Streamer Checker | `setupStreamerChecker(client)` | Polls Twitch/YouTube APIs periodically |
| Ticket Auto-Close | `setupTicketAutoClose(client)` | Checks for stale open tickets on an interval |

Plus in `registerAnalytics`: `setupAggregator()` runs the analytics roll-up on a fixed interval.

All jobs handle their own errors internally. A crash inside a job's interval callback is caught and logged without stopping the interval.

---

## Logger (`src/utils/logger.ts`)

A lightweight custom logger with four levels (`info`, `warn`, `error`, `debug`). Writes formatted lines to stdout/stderr and maintains an in-memory ring buffer of the last 500 entries. The dashboard reads this buffer for its log stream endpoint.

---

## Environment Variables (key subset)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot login token |
| `CLIENT_ID` | Yes | Bot application ID (for slash command deploy) |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/bot.db`) |
| `DASHBOARD_ENABLED` | No | Set to `true` to start the web dashboard |
| `DASHBOARD_SESSION_SECRET` | If dashboard | Must be changed in production |
| `DISCORD_CLIENT_SECRET` | If dashboard | For OAuth login |
| `ANALYTICS_ENABLED` | No | Set to `true` to enable activity tracking |
| `AI_PROVIDER` | No | `gemini` (default), `groq`, or `openrouter` |

See `docs/SECURITY.md` for the full production environment checklist.
