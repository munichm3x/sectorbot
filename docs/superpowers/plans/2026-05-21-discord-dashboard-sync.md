# Discord ↔ Dashboard Sync Implementation Plan (Phase H)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Sync content between Discord channels and Dashboard CMS. Dashboard pushes changes to Discord embeds on save. Discord Scheduled Events pull into DB. Existing changelog modal-flow gets DB persistence. Initial import seeds DB from existing Discord content.

**Architecture:** New `src/services/discordSync/` module: embed builders + sync service. Hook into existing admin CRUD routes — after successful DB write, async push to Discord (fail-safe: sync error doesn't abort the save). Discord event listeners for scheduled events. New Discord slash commands `/rules`, `/announce`, `/faq`, `/wipe` for Discord-side editing. New `/sync-import` admin command for initial import.

**Tech Stack:** TypeScript + discord.js + existing Express/SQLite.

---

## Channel Configuration

Each content type needs a target channel-ID in `bot_settings`:
- `rules_channel_id` (already exists in `guild_config`)
- `changelog_channel_id` (already exists in `changelog_config.public_channel_id`)
- `announcements_channel_id` (new — `bot_settings.channel/announcements_channel_id`)
- `events_channel_id` (Discord Scheduled Events are guild-wide, no channel needed)
- `faq_channel_id` (new)
- `server_info_channel_id` (new — or reuse scum-status channel)

---

## Task H1: Discord Embed Builders

**Files:**
- Create: `src/services/discordSync/embeds.ts`

Build typed embed factory functions for each content type:

```typescript
import { EmbedBuilder, type APIEmbed } from 'discord.js';
import type { RuleEntry, PublicEvent, ChangelogEntry, PublicAnnouncement, FaqItem, WipeInfo, ServerPublicInfo } from '../../types';

// Brand colors (match dashboard accent)
export const COLOR_ACCENT = 0xb5162f;
export const COLOR_ONLINE = 0x3bca6e;
export const COLOR_WARN   = 0xe8981a;
export const COLOR_INFO   = 0x4a9eff;

export function buildRulesEmbed(rules: RuleEntry[], opts: { bannerUrl?: string; lastUpdated?: number }): APIEmbed[] {
  // Group by category, one embed per category (Discord max 10 embeds per message)
  // Title = category label, Description = rules joined with bullet points
  // First embed has banner, last has footer with timestamp
}

export function buildChangelogEmbed(entry: ChangelogEntry): APIEmbed {
  // Color by category, title with optional version, description = body, footer = category
}

export function buildAnnouncementEmbed(announcement: PublicAnnouncement): APIEmbed {
  // Color by type (info/maint/warn/event/whitelist/rules), priority shown in footer if >0
}

export function buildEventEmbed(event: PublicEvent): APIEmbed {
  // Title, description, fields: type/date/end-time, status badge
}

export function buildFaqEmbed(items: FaqItem[]): APIEmbed[] {
  // Group by category, fields[] with q+a (max 25 fields per embed)
}

export function buildServerInfoEmbed(info: ServerPublicInfo, wipe: WipeInfo | null): APIEmbed {
  // Server identity + rules + wipe info combined
}

export function buildWipeInfoEmbed(wipe: WipeInfo): APIEmbed {
  // Standalone wipe embed
}
```

Use `escape*` helpers from discord.js where needed for Markdown safety.

- [ ] Implement embed builders
- [ ] Commit: `feat(sync): discord embed builders for all content types`

---

## Task H2: Discord Sync Service

**Files:**
- Create: `src/services/discordSync/index.ts`

Core sync service. Each function: fetches data from DB, builds embed(s), posts or edits Discord message, stores message_id back to DB.

```typescript
import type { Client, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { getDb } from '../../db/index';
import { /* DB helpers */ } from '../../db/index';
import { /* embed builders */ } from './embeds';

export interface SyncResult { success: boolean; messageId?: string; error?: string; }

export async function pushRulesToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  // 1. Load rules from DB (publicOnly: true)
  // 2. Load guild_config for rules_channel_id + rules_message_id
  // 3. Build embeds
  // 4. If rules_message_id exists: edit existing message
  //    Else: send new message, store new ID in guild_config
  // 5. Attach Accept-Rules button (existing component) — DON'T break existing flow
}

export async function pushChangelogToDiscord(client: Client, entryId: number): Promise<SyncResult> {
  // 1. Load changelog entry from DB
  // 2. If entry.discord_message_id exists: edit existing message
  //    Else: post new message in changelog_config.public_channel_id, store ID back
}

export async function pushAnnouncementToDiscord(client: Client, announcementId: number): Promise<SyncResult> {
  // 1. Load announcement
  // 2. Check if active=1 AND time-window valid:
  //    - Yes + has discord_message_id: edit + ensure pinned
  //    - Yes + no message_id: post + pin
  //    - No: if has discord_message_id, delete the discord message
  // 3. Store/clear discord_message_id
  // Channel-ID from bot_settings.channel/announcements_channel_id
}

export async function pushEventToDiscord(client: Client, eventId: number): Promise<SyncResult> {
  // 1. Load event
  // 2. If event has discord_event_id (new column needed): update Discord Scheduled Event
  //    Else: create Discord Scheduled Event via guild.scheduledEvents.create(...)
  // 3. Store discord_event_id back
  // 4. On cancellation (status=cancelled): delete or cancel Discord event
}

export async function pushFaqToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  // 1. Load all FAQ items (publicOnly)
  // 2. Build category-grouped embeds
  // 3. Single message per guild in faq_channel_id from settings
  //    Stored ID in bot_settings.dashboard/faq_message_id
}

export async function pushServerInfoToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  // Similar pattern — single message, stored ID
}

// Helper
async function fetchChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    return ch?.isTextBased() && 'send' in ch ? (ch as TextChannel) : null;
  } catch { return null; }
}
```

All sync functions:
- Wrapped in try/catch — never throw, return SyncResult
- Log errors via logger.error
- Are idempotent (safe to call multiple times)
- Update DB with discord_message_id after successful send/edit

**DB Schema changes needed:**
- `public_events`: add column `discord_event_id TEXT` (for Scheduled Events linking)
- `public_announcements`: add column `discord_message_id TEXT` (sync target)
- `bot_settings` already supports arbitrary keys — use for `dashboard/faq_message_id` and `dashboard/server_info_message_id`

ALTER TABLE migrations in `src/db/index.ts`:
```typescript
try { db.exec(`ALTER TABLE public_events ADD COLUMN discord_event_id TEXT`); } catch {}
try { db.exec(`ALTER TABLE public_announcements ADD COLUMN discord_message_id TEXT`); } catch {}
```

- [ ] Implement sync service
- [ ] Add DB migrations
- [ ] Commit: `feat(sync): discord sync service - push for rules/changelog/announcements/events/faq/server-info`

---

## Task H3: Hook Sync into Admin CRUD Routes

**Files:**
- Modify: `src/dashboard/routes/api/admin/rules.routes.ts`
- Modify: `src/dashboard/routes/api/admin/changelog.routes.ts`
- Modify: `src/dashboard/routes/api/admin/announcements.routes.ts`
- Modify: `src/dashboard/routes/api/admin/events.routes.ts`
- Modify: `src/dashboard/routes/api/admin/faq.routes.ts`
- Modify: `src/dashboard/routes/api/admin/server-info.routes.ts`
- Modify: `src/dashboard/routes/api/admin/wipe.routes.ts`
- Modify: `src/dashboard/routes/api/index.ts` (pass client to admin routers)

After every successful POST/PATCH/DELETE, trigger sync **asynchronously**:

```typescript
// Inside rules POST handler, after successful create:
const created = createRule({...});
insertAuditLog({...});
res.json({ success: true, data: created });

// Then (don't await, log on failure):
pushRulesToDiscord(client, user.guildId).catch(err => {
  logger.error('[sync] rules push failed:', err);
});
```

Pattern:
- Response sent immediately — UX not blocked by Discord API
- Sync runs in background
- Failures logged, optionally reported via separate `/api/sync/last-status` endpoint

Special cases:
- Changelog `POST /:id/publish` → must trigger sync (otherwise Discord embed never posted)
- Announcement: trigger on create/update AND when `active` flips
- Event delete: must delete Discord Scheduled Event too
- Wipe: trigger sync of Server-Info embed (wipe is shown alongside)

The routers need access to `client: Client`. Convert each router from `export const xxxRouter = Router()` to `export function xxxRouter(client: Client): Router { ... }` and update `api/index.ts` to pass client.

- [ ] Convert routers to accept client
- [ ] Wire sync calls into each handler
- [ ] Commit: `feat(sync): auto-push to discord on dashboard saves`

---

## Task H4: Discord → DB Listeners (Pull)

**Files:**
- Create: `src/features/discordSync/eventListeners.ts`
- Modify: `src/client.ts` (register listeners)
- Modify: `src/features/changelogDashboard.ts` (persist to DB)

### H4a: Discord Scheduled Events sync to DB

Listen on `client.on('guildScheduledEventCreate' | 'guildScheduledEventUpdate' | 'guildScheduledEventDelete')`:
- On create/update: upsert into `public_events` table, set `discord_event_id`, status mapped from Discord status (1=SCHEDULED→'scheduled', 2=ACTIVE→'live', 3=COMPLETED→'ended', 4=CANCELED→'cancelled')
- On delete: mark event as cancelled in DB (don't hard-delete — admin might want history)

Important: avoid sync loops — if we just pushed an event to Discord (created discord_event_id), and Discord then fires update, we'd loop. Use a short-lived in-memory Set of `discord_event_id`s recently written by our push, ignore the next inbound event for them.

### H4b: Existing changelog modal flow → DB

Current `src/features/changelogDashboard.ts` has a modal-based draft editor that posts directly to Discord. Modify the publish step to also `createChangelogEntry(...)` in DB so the Dashboard sees it.

- [ ] Implement listeners
- [ ] Register in client.ts
- [ ] Wire changelog modal to DB
- [ ] Commit: `feat(sync): discord events sync to db + changelog modal persistence`

---

## Task H5: Initial Import

**Files:**
- Create: `src/services/discordSync/import.ts`
- Create: `src/commands/sync-import.ts` (admin slash command)
- Modify: `src/deploy.ts` (register new command)

`/sync-import` admin slash command. Lists what's importable, runs import on confirm. Or a button in Dashboard System-Page that calls `POST /api/system/sync-import`.

Per-content-type import logic:

**Rules:**
- Fetch existing rules-channel message (via `guild_config.rules_message_id`)
- If message has embeds: parse each embed → one rule per embed
- If message has plain text: split by lines/sections heuristically
- Insert into `rules` table with `public_visible=1`

**Changelog:**
- Fetch last 50 messages from `changelog_config.public_channel_id`
- For each: extract title (first line or embed title), body (rest)
- Insert as `status='published'` with `published_at = message.createdTimestamp / 1000`

**Events (Discord Scheduled Events):**
- Iterate `guild.scheduledEvents.cache` (or fetch())
- Upsert into `public_events` with `discord_event_id` set
- Map Discord status → DB status

**FAQ / Announcements / Server-Info / Wipe-Info:**
- No reliable source channel → import skipped, user enters manually in Dashboard

Output: report of what was imported (counts per type).

- [ ] Implement import service
- [ ] Add slash command
- [ ] Wire dashboard system endpoint for button trigger
- [ ] Commit: `feat(sync): initial discord → db import command + endpoint`

---

## Task H6: Discord-Side Slash Commands

**Files:**
- Create: `src/commands/rules-edit.ts`
- Create: `src/commands/announce.ts`
- Create: `src/commands/wipe.ts`
- Create: `src/commands/faq-add.ts`
- (Existing) `src/commands/changelog*.ts` already handles changelog editing
- Modify: `src/deploy.ts`

Each command opens a modal for structured input, writes to DB, triggers sync.

`/rules-edit category:<select> title:<text> body:<textarea>` — quick add/edit a rule
`/announce title body type duration` — create an announcement
`/wipe` — opens a modal to set season/last/next wipe
`/faq-add category question answer`

For now, MVP: just `/announce` and `/wipe`. Others can be added later. Most Discord-side editing remains via the Dashboard (which is the more comfortable UX anyway).

- [ ] Implement minimum slash commands (announce, wipe)
- [ ] Commit: `feat(sync): discord-side slash commands for announce + wipe`

---

## Task H7: Build, Deploy, Verify

- [ ] `npm run build` — zero TS errors
- [ ] `pm2 restart scum-bot`
- [ ] Smoke test:
  - Dashboard: create a rule → check it appears in Discord
  - Dashboard: publish a changelog → check Discord channel gets embed
  - Dashboard: create active announcement → check pinned in Discord
  - Discord: create scheduled event → check it appears in Dashboard
  - Dashboard: delete an event → check Discord event deleted/cancelled
- [ ] `/sync-import` test: run on real Discord guild, verify imports
- [ ] Commit + push

---

## Loop-Prevention & Robustness

- Each sync function has try/catch — never throws, never blocks the API response
- Inbound listeners check a short-lived ignore-set to skip events triggered by our own outbound writes
- Audit log captures sync failures with `action: 'sync.<type>.failed'` (visible in dashboard logs)
- Rate-limit: max 1 sync per content-type per 2 seconds (debounce) to avoid hammering Discord API on rapid edits

---

## Definition of Done

- [ ] Dashboard save → Discord embed appears/updates (all 6 types)
- [ ] Discord Scheduled Event create/edit/cancel → Dashboard reflects within seconds
- [ ] Existing Discord changelog flow → DB persistence works
- [ ] `/sync-import` populates DB from existing Discord content
- [ ] No sync loops
- [ ] No blocking of dashboard saves on Discord failures
- [ ] Build zero errors, tests pass
- [ ] Admin dashboard fully functional
- [ ] Public dashboard fully functional
