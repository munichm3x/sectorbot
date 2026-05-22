# Admin Dashboard Control Center — Implementation Plan (Phase G)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform admin dashboard into the central bot control center. Mirror all public content with full CRUD management, add comprehensive settings management for every configurable aspect of the bot, redesign admin overview with public KPIs + admin KPIs + quick actions.

**Architecture:** Pure additive extension on top of existing admin dashboard. New DB tables for public content (rules/events/changelog/announcements/faq/wipe_info/bot_settings). Public API public-data.ts switches from hardcoded to DB-backed reads — schema stays identical so public frontend unchanged. New admin API namespaces under `/api/admin/*` for CRUD and settings. New admin frontend pages added without removing existing ones.

**Tech Stack:** TypeScript + Express + better-sqlite3 + vanilla JS SPA + Chart.js (existing stack, no new deps).

---

## Security & Privacy Constraints (apply to every task)

- All admin endpoints require `requireAuth` + `requirePermission(level)`
- All write operations write to `dashboard_audit_logs`
- Secrets never serialized to JSON responses (API keys, tokens, session secret) — replaced with `'***'` or omitted
- Public API never returns admin-only fields (e.g., `public_visible: false` content)
- Error responses use generic German messages, no stacktraces
- All user-controlled values passed through `escapeHtml()` before insertion into `.innerHTML`
- `EnumPermissionLevel` boundaries: Owner > Admin > Moderator > Editor > Viewer

---

## Permission Levels (G19 introduces these)

- **Owner (4)** — everything, including dangerous system actions
- **Admin (3)** — settings + content + tickets + analytics
- **Moderator (2)** — tickets + moderation + read-only settings
- **Editor (2)** — rules/events/changelog/announcements CRUD only (no settings)
- **Viewer (1)** — read-only on everything they're allowed to see

Existing `PermLevel` enum is Owner=4, Admin=3, Moderator=2, Viewer=1. We add Editor at level 2 (same as Moderator but different permission set) — or treat them as the same level with different role IDs. **Decision:** keep enum, add new ENV var `DASHBOARD_EDITOR_ROLE_IDS` for content-only editors who get `PermLevel.Moderator` but a new boolean flag `isContentEditor`.

---

## Task G1: Database Schema — new tables

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new tables to schema.ts**

Tables to add (all with `guild_id` for multi-guild support):

```sql
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,          -- e.g. 'general', 'pvp', 'teams', 'vehicles'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  public_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_guild_category ON rules(guild_id, category, sort_order);

CREATE TABLE IF NOT EXISTS public_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'community',  -- pvp, raid, solo, airfield, bunker, trader, meeting, wipe, community
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',      -- draft, scheduled, live, ended, cancelled
  discord_url TEXT,
  banner_url TEXT,
  public_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_guild_status ON public_events(guild_id, status, starts_at);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'server',  -- server, discord, rules, events, bot
  version TEXT,
  status TEXT NOT NULL DEFAULT 'draft',     -- draft, published, archived
  published_at INTEGER,
  discord_message_id TEXT,
  public_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changelog_guild_status ON changelog_entries(guild_id, status, published_at);

CREATE TABLE IF NOT EXISTS public_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  announcement_type TEXT NOT NULL DEFAULT 'info',  -- info, maintenance, warning, event, whitelist, rules
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  show_as_banner INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  public_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_guild_active ON public_announcements(guild_id, active, starts_at);

CREATE TABLE IF NOT EXISTS faq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,         -- Server, Whitelist, Regeln, Support, Discord, Community
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  public_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_faq_guild ON faq_items(guild_id, category, sort_order);

CREATE TABLE IF NOT EXISTS bot_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,         -- general, dashboard, server, ticket, role, channel, ai, streamer, whitelist, moderation, design, security
  setting_key TEXT NOT NULL,
  setting_value TEXT,              -- JSON-encoded value
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(guild_id, category, setting_key)
);
CREATE INDEX IF NOT EXISTS idx_settings_guild_cat ON bot_settings(guild_id, category);

CREATE TABLE IF NOT EXISTS wipe_info (
  guild_id TEXT PRIMARY KEY,
  current_season INTEGER,
  season_name TEXT,
  last_wipe_at INTEGER,
  last_wipe_type TEXT,             -- full, partial, economy, character
  next_wipe_at INTEGER,
  next_wipe_type TEXT,
  notes TEXT,
  public_visible INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS server_public_info (
  guild_id TEXT PRIMARY KEY,
  server_name TEXT,
  description TEXT,
  game_mode TEXT,                  -- PvP, PvE, Mixed
  max_team_size INTEGER,
  solo_color TEXT,                 -- e.g. 'Orange'
  loot_rate TEXT,
  safezones INTEGER,
  permadeath INTEGER,
  vehicle_limit TEXT,
  base_limit TEXT,
  restart_times TEXT,
  map_region TEXT,
  join_hint TEXT,                  -- e.g. 'IP wird im Discord geteilt'
  show_host_in_public INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Add types to `src/types/index.ts`**

```typescript
export interface RuleEntry {
  id: number;
  guild_id: string;
  category: string;
  title: string;
  body: string;
  sort_order: number;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}
// ...similar for PublicEvent, ChangelogEntry, PublicAnnouncement, FaqItem, BotSetting, WipeInfo, ServerPublicInfo
```

- [ ] **Step 3: Run build + commit**

`feat(db): schema for rules, events, changelog, announcements, faq, settings, wipe_info, server_public_info`

---

## Task G2: DB Helper Functions

**Files:**
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add CRUD helpers**

For each new table, add:
```typescript
export function listRules(guildId: string, opts?: { publicOnly?: boolean }): RuleEntry[] { ... }
export function getRule(id: number): RuleEntry | null { ... }
export function createRule(input: Omit<RuleEntry, 'id'|'created_at'|'updated_at'>): RuleEntry { ... }
export function updateRule(id: number, patch: Partial<RuleEntry>, updatedBy: string): RuleEntry { ... }
export function deleteRule(id: number): boolean { ... }
export function reorderRules(guildId: string, category: string, orderedIds: number[]): void { ... }
```

Repeat pattern for: events, changelog, announcements, faq, settings, wipe_info, server_public_info.

For `bot_settings`: helper `getSetting(guildId, category, key)` and `upsertSetting(guildId, category, key, value, isSecret, updatedBy)`. Settings should NEVER return `setting_value` when `is_secret=1` from public-facing helpers — add separate `getSecretSetting` (admin-only).

- [ ] **Step 2: Commit**

`feat(db): CRUD helpers for new public-content + settings tables`

---

## Task G3: Public API DB-backed reads

**Files:**
- Modify: `src/dashboard/routes/public-api/public-data.ts`
- Modify: `src/dashboard/routes/public-api/index.ts`

- [ ] **Step 1: Switch hardcoded rules to DB read**

In `buildRulesPayload`, if `rules` table has any rows for the guild → return DB rows grouped by category. Otherwise fall back to current hardcoded list (so existing deployments keep working until admin adds rules).

- [ ] **Step 2: Real events from DB**

Replace `/events` endpoint to read `public_events` where `public_visible=1 AND status IN ('scheduled','live','ended') AND (ends_at IS NULL OR ends_at >= NOW())`. Sort by `starts_at`.

- [ ] **Step 3: Real changelog from DB**

Replace `/changelog` to read `changelog_entries` where `status='published' AND public_visible=1`. Sort by `published_at DESC`. Limit 20.

- [ ] **Step 4: Real announcements from DB**

Replace `/announcements` to read `public_announcements` where `active=1 AND public_visible=1 AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW())`. Sort by priority DESC, starts_at DESC.

- [ ] **Step 5: Real FAQ from DB**

Replace `/faq` to read `faq_items` where `public_visible=1`. Group by category. Sort by sort_order.

- [ ] **Step 6: Real wipe info to /server**

In existing `/server` router (server.ts), append `wipe` and `serverInfo` to response from `wipe_info` and `server_public_info` tables (only fields with `public_visible=1` or all of server_public_info if it's all public).

- [ ] **Step 7: Build + commit**

`feat(public-api): DB-backed reads for rules, events, changelog, announcements, faq, wipe, server-info`

Public frontend should work identically — schema unchanged. Empty states remain when tables are empty.

---

## Task G4: Admin API — Rules CRUD

**Files:**
- Create: `src/dashboard/routes/api/admin/rules.routes.ts`
- Modify: `src/dashboard/routes/api/index.ts`

- [ ] **Step 1: Build router**

```typescript
GET    /api/admin/rules                  → list all (incl. non-public)
GET    /api/admin/rules/:id              → get one
POST   /api/admin/rules                  → create
PATCH  /api/admin/rules/:id              → update
DELETE /api/admin/rules/:id              → delete
POST   /api/admin/rules/reorder          → reorder within category
```

All require `PermLevel.Moderator` minimum. Audit log on writes. Body validation (title required, body required, category from known list).

- [ ] **Step 2: Wire + commit**

`feat(admin-api): rules CRUD endpoints`

---

## Task G5: Admin API — Events + Changelog CRUD

**Files:**
- Create: `src/dashboard/routes/api/admin/events.routes.ts`
- Create: `src/dashboard/routes/api/admin/changelog.routes.ts`

Same CRUD pattern as rules. Events allow status transitions (draft → scheduled → live → ended). Changelog allows draft → published (with optional Discord post hook).

- [ ] **Step 1: Build both routers**
- [ ] **Step 2: Wire + commit**

`feat(admin-api): events + changelog CRUD endpoints`

---

## Task G6: Admin API — Announcements + FAQ + Wipe + Server Info CRUD

**Files:**
- Create: `src/dashboard/routes/api/admin/announcements.routes.ts`
- Create: `src/dashboard/routes/api/admin/faq.routes.ts`
- Create: `src/dashboard/routes/api/admin/wipe.routes.ts`
- Create: `src/dashboard/routes/api/admin/server-info.routes.ts`

Same pattern. Wipe and server-info are upsert (single row per guild, not list).

- [ ] **Step 1: Build all 4 routers**
- [ ] **Step 2: Wire + commit**

`feat(admin-api): announcements + faq + wipe + server-info CRUD`

---

## Task G7: Admin API — Settings endpoints

**Files:**
- Create: `src/dashboard/routes/api/admin/settings.routes.ts`

Endpoints:
```
GET    /api/admin/settings?category=<cat>           → list settings (secret values masked)
PATCH  /api/admin/settings                          → bulk upsert {category, settings: [{key, value, isSecret}]}
POST   /api/admin/settings/test/:category/:key      → test action (e.g. SCUM ping, Twitch API, AI prompt)
```

Categories: `general`, `dashboard`, `server`, `ticket`, `role`, `channel`, `ai`, `streamer`, `whitelist`, `moderation`, `design`, `security`.

Secret settings (API keys, tokens) always masked in GET responses as `'***'` (or omitted if never set). PATCH allows replacing secrets with new values; the new value is stored, never logged.

- [ ] **Step 1: Build router**
- [ ] **Step 2: Wire + commit**

`feat(admin-api): unified settings endpoints with secret masking`

---

## Task G8: Admin API — Public Preview + System Info

**Files:**
- Create: `src/dashboard/routes/api/admin/public-preview.routes.ts`
- Create: `src/dashboard/routes/api/admin/system.routes.ts`

`GET /api/admin/public-preview` → returns same shape as public overview + status of which public sections have data vs empty (for warnings on admin overview).

`GET /api/admin/system` → bot uptime, Node version, DB size, last restart, ENV-presence check (without values), missing-config warnings.

`POST /api/admin/system/cache-clear` (Owner only) → clears Discord cache.
`POST /api/admin/system/resync-commands` (Owner only) → re-deploys slash commands.

- [ ] **Step 1: Build both routers**
- [ ] **Step 2: Wire + commit**

`feat(admin-api): public-preview + system endpoints`

---

## Task G9: Admin Frontend — Navigation + Shell + CSS

**Files:**
- Modify: `dashboard/public/index.html`
- Modify: `dashboard/public/js/app.js`
- Modify: `dashboard/public/js/api.js`
- Modify: `dashboard/public/css/dashboard.css`

- [ ] **Step 1: New navigation structure**

Replace admin sidebar nav with grouped structure:
```
ÜBERSICHT
- Dashboard (overview)
- Public Preview (public-preview)

COMMUNITY (NEW SECTION)
- Serverstatus (server-status) - existing
- Mitglieder (members) - existing
- Analytics (analytics-*) - existing

INHALTE (NEW SECTION)
- Regelwerk (admin-rules)
- Events (admin-events)
- Changelog (admin-changelog)
- Announcements (admin-announcements)
- FAQ (admin-faq)
- Server-Info (admin-server-info)
- Wipe-Info (admin-wipe)

VERWALTUNG
- Tickets (tickets) - existing
- AI (ai) - existing

EINSTELLUNGEN (NEW SECTION)
- Allgemein (settings-general)
- Dashboard (settings-dashboard)
- Server (settings-server)
- Tickets (settings-tickets)
- Rollen & Teams (settings-roles)
- Channels (settings-channels)
- AI (settings-ai)
- Streamer (settings-streamer)
- Whitelist (settings-whitelist)
- Moderation (settings-moderation)
- Design (settings-design)
- Security (settings-security)

SYSTEM
- Logs (logs) - existing
- System (system) - existing settings.js absorbed/renamed
```

- [ ] **Step 2: Extend api.js**

Add for every new endpoint:
```javascript
adminRules: { list: () => API.get('/admin/rules'), get: (id) => ..., create: (body) => ..., update: (id, body) => ..., delete: (id) => ..., reorder: (body) => ... },
adminEvents: { ... },
adminChangelog: { ... },
adminAnnouncements: { ... },
adminFaq: { ... },
adminWipe: { get: () => ..., upsert: (body) => ... },
adminServerInfo: { get: () => ..., upsert: (body) => ... },
adminSettings: { list: (cat) => ..., update: (body) => ..., test: (cat, key, body) => ... },
publicPreview: () => ...,
adminSystem: { get: () => ..., cacheClear: () => ..., resyncCommands: () => ... },
```

- [ ] **Step 3: Add PAGE_TITLES + dynamic loadScript paths**

`PAGE_TITLES` gets entries for all new pages. `loadScript` already loads `/js/pages/${page}.js` so new pages just need to exist as files.

- [ ] **Step 4: CSS additions for admin content management UI**

Add to admin dashboard.css:
- `.crud-toolbar` — search + filter + "Neu" button row
- `.crud-list-item` — list row with title, badges, actions
- `.crud-editor` — split view (list left, editor right) on desktop
- `.form-textarea` — multi-line input
- `.form-checkbox-row` — labeled checkbox
- `.settings-section` — settings card with title bar + form grid
- `.secret-input` — input with "ersetzen" mode toggle
- `.danger-zone` — red-bordered card for destructive actions
- `.preview-frame` — iframe-style container for public preview embed

- [ ] **Step 5: Commit**

`style(admin): navigation + CSS for content management + settings UI`

---

## Task G10: Admin Page — Rules Management

**Files:**
- Create: `dashboard/public/js/pages/admin-rules.js`

Pattern: split-view CRUD editor.
- Left: search + category filter + ordered list of rules
- Right: form for selected rule (title, body textarea, category select, sort_order, public_visible checkbox)
- Toolbar: "Neue Regel" button, "Speichern", "Löschen" (with confirm)
- Drag-handle indicators (visual only — actual reorder via up/down buttons + bulk reorder API call)

- [ ] **Step 1: Build page**
- [ ] **Step 2: Commit**

`feat(admin): rules management page`

---

## Task G11: Admin Page — Events + Changelog Management

**Files:**
- Create: `dashboard/public/js/pages/admin-events.js`
- Create: `dashboard/public/js/pages/admin-changelog.js`

Same split-view pattern. Events have status workflow (draft/scheduled/live/ended). Changelog has draft → published flow with optional Discord URL field.

- [ ] **Step 1: Build both pages**
- [ ] **Step 2: Commit**

`feat(admin): events + changelog management pages`

---

## Task G12: Admin Page — Announcements + FAQ Management

**Files:**
- Create: `dashboard/public/js/pages/admin-announcements.js`
- Create: `dashboard/public/js/pages/admin-faq.js`

Announcements: list with type badges, priority sorting, start/end date inputs, show-as-banner toggle. FAQ: category-grouped, simple Q&A pairs.

- [ ] **Step 1: Build both pages**
- [ ] **Step 2: Commit**

`feat(admin): announcements + faq management pages`

---

## Task G13: Admin Page — Server Info + Wipe Info

**Files:**
- Create: `dashboard/public/js/pages/admin-server-info.js`
- Create: `dashboard/public/js/pages/admin-wipe.js`

Single-form pages (upsert single row). Server Info: PvP/PvE select, max team size, solo color, safezones, permadeath, vehicle/base limits, restart times, join hint, show-host-in-public toggle.

Wipe Info: current season number + name, last wipe date+type, next wipe date+type, notes.

- [ ] **Step 1: Build both pages**
- [ ] **Step 2: Commit**

`feat(admin): server info + wipe info pages`

---

## Task G14: Admin Settings Pages — General + Dashboard + Server

**Files:**
- Create: `dashboard/public/js/pages/settings-general.js`
- Create: `dashboard/public/js/pages/settings-dashboard.js`
- Create: `dashboard/public/js/pages/settings-server.js`

Settings pattern: form sections per page, "Speichern" sticky bottom bar, success/error toast on save, audit hint on form ("Änderung wird protokolliert").

General: bot name, timezone, language, logging level, maintenance mode toggle, debug mode.
Dashboard: dashboard name, public-section toggles (server/community/regeln/events/changelog/support/faq each ja/nein), branding text fields.
Server: SCUM host, query port, server name override, check interval, status-channel select, status-message-id display, public visibility toggles, test/resend buttons (calls existing `/api/server-status/*` admin routes).

- [ ] **Step 1: Build all 3 pages**
- [ ] **Step 2: Commit**

`feat(admin-settings): general + dashboard + server settings pages`

---

## Task G15: Admin Settings — Tickets + Roles + Channels

**Files:**
- Create: `dashboard/public/js/pages/settings-tickets.js`
- Create: `dashboard/public/js/pages/settings-roles.js`
- Create: `dashboard/public/js/pages/settings-channels.js`

Tickets: ticket-system enable, categories (list editor), support roles, archive channel, transcript toggle, AI summary toggle, auto-close enable + time, max open per user, ticket-creation public toggle, FAQ hint before open.

Roles: team color roles (Grün/Rot/Blau/Gelb/Orange selects fed by guild.roles.cache list), support roles, admin/mod/viewer roles, verified role, streamer role, auto-assignment toggle.

Channels: status/ticket/archive/log/changelog/rules/event/announcement/whitelist/streamer-live/team-text/team-voice channel selects. Each row: "Channel auswählen" dropdown + ID display + Copy + Test button.

- [ ] **Step 1: Build all 3 pages**
- [ ] **Step 2: Commit**

`feat(admin-settings): tickets + roles + channels settings pages`

---

## Task G16: Admin Settings — AI + Streamer + Whitelist

**Files:**
- Create: `dashboard/public/js/pages/settings-ai.js`
- Create: `dashboard/public/js/pages/settings-streamer.js`
- Create: `dashboard/public/js/pages/settings-whitelist.js`

AI: enable, provider select (Groq/OpenAI/Ollama), model name, API key (.secret-input replacement only), base URL, temperature, max tokens, feature toggles (ticket-summary, changelog-help, moderation-help, faq-help), test prompt button.

Streamer: enable, Twitch client ID, Twitch client secret (.secret-input), streamer role select, live announcement channel, embed customization, check interval, auto-detection toggle, test Twitch API button.

Whitelist: enable, public whitelist-status toggle, application-form toggle, whitelist role select, verified role select, application channel select, log channel select, approval workflow toggle, auto-role toggle.

- [ ] **Step 1: Build all 3 pages**
- [ ] **Step 2: Commit**

`feat(admin-settings): ai + streamer + whitelist settings pages`

---

## Task G17: Admin Settings — Moderation + Design + Security + System

**Files:**
- Create: `dashboard/public/js/pages/settings-moderation.js`
- Create: `dashboard/public/js/pages/settings-design.js`
- Create: `dashboard/public/js/pages/settings-security.js`
- Create: `dashboard/public/js/pages/system.js`

Moderation: mod-log channel, automod toggle, warning system toggle, raid-protection toggle, mod role list.

Design: dashboard titles (public + admin), logo URL, banner URL, accent color picker, footer text, bot embed colors (status/ticket/changelog/announcement), thumbnail/banner image URLs. Live preview swatch for color values.

Security: admin user IDs (list editor), admin role IDs (list editor), viewer role IDs, content-editor role IDs, public dashboard enable, session info (sessions count + age, not secret), last admin logins list (read-only), rate-limit status.

System: bot uptime, Node version, DB path + size, last restart, ENV presence list (key name + present/missing, never values), missing-config warnings, dangerous-actions section with confirm modal (cache clear, command resync — Owner only).

- [ ] **Step 1: Build all 4 pages**
- [ ] **Step 2: Commit**

`feat(admin-settings): moderation + design + security + system pages`

---

## Task G18: Admin Page — Public Preview + Overview Redesign

**Files:**
- Create: `dashboard/public/js/pages/public-preview.js`
- Modify: `dashboard/public/js/pages/overview.js`

- [ ] **Step 1: public-preview.js**

Two-pane view:
- Left: list of public sections with status (Server: ✓ Daten, Regeln: ✓ N Regeln aktiv, Events: ⚠ Keine Events geplant, etc.) — pulls from `/api/admin/public-preview`
- Right: button "Public Dashboard öffnen" (opens `/public` in new tab) + small iframe embedding `/public` (with sandbox attrs) OR screenshot-style mockup if iframe not feasible
- Section warnings: "Diese Public-Section ist leer — Inhalte über Verwaltung erstellen" with deep-link to admin-rules/admin-events/etc.

- [ ] **Step 2: overview.js redesign**

Add to existing admin overview:
- New section "Public Hub Status" between existing stat-grid and quick cards
- 4-card row: Server (public status), Events (count active), Changelog (count published), Announcements (count active)
- Each card has "→ Verwalten" link to corresponding admin page
- New section "Quick Actions" with buttons: "Status prüfen", "Event erstellen", "Changelog erstellen", "Announcement erstellen", "Public Dashboard öffnen"
- Keep existing 8 KPI stat-cards + serverstatus/tickets quick cards

- [ ] **Step 3: Commit**

`feat(admin): public preview page + overview redesign with hub status + quick actions`

---

## Task G19: Permission Level extension

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/dashboard/auth/middleware.ts`
- Modify: `src/dashboard/auth/discord-oauth.ts` (or wherever roles are resolved)

- [ ] **Step 1: Add `DASHBOARD_EDITOR_ROLE_IDS` env**

Comma-separated role IDs. Editors have `PermLevel.Moderator` plus a new boolean `isContentEditor=true`. They can edit rules/events/changelog/announcements/faq but cannot touch settings.

- [ ] **Step 2: Extend DashboardUser type**

```typescript
export interface DashboardUser {
  userId:    string;
  username:  string;
  avatar:    string | null;
  permLevel: PermLevel;
  isContentEditor: boolean;
  guildId:   string;
}
```

- [ ] **Step 3: New middleware `requireContentEditor`**

```typescript
export function requireContentEditor(req, res, next) {
  const u = req.session.user;
  if (!u || (u.permLevel < PermLevel.Moderator && !u.isContentEditor)) {
    res.status(403).json({ success: false, error: 'Insufficient permissions' });
    return;
  }
  next();
}
```

Use on content CRUD routes (rules/events/changelog/announcements/faq). Settings use existing `requirePermission(PermLevel.Admin)`.

- [ ] **Step 4: Commit**

`feat(auth): content editor permission level`

---

## Task G20: Final Build + Deploy + End-to-end Verification

- [ ] **Step 1: TypeScript build**

```bash
cd "C:\Users\Administrator\Desktop\sectorbot" && npx tsc --noEmit
```
Zero errors.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```
All pass.

- [ ] **Step 3: PM2 restart**

```bash
pm2 restart scum-bot
```

- [ ] **Step 4: Smoke test admin**

- Visit `/` → admin overview loads with new Public Hub Status section
- Navigate every settings page → all load without errors
- Navigate every admin content page → all load + show CRUD UI
- Create one rule, one event, one announcement, one FAQ entry, one changelog entry
- Verify each appears in public dashboard
- Edit and delete each
- Verify public dashboard updates accordingly

- [ ] **Step 5: Smoke test public**

- Visit `/public` → all sections still work
- Rules now show DB content (or hardcoded fallback if no DB content)
- Events page shows DB events
- Changelog shows DB entries
- Announcements appear on overview if active

- [ ] **Step 6: Security verification**

- Visit `/public-api/me/whitelist-status` while logged out → 401
- Try GET `/api/admin/rules` while public-authed (not admin) → 401/403
- Verify settings GET returns `'***'` for secret values
- Verify audit log has entries for each create/update/delete done in step 4

- [ ] **Step 7: Commit final**

`feat(admin): control center deployment complete`

---

## Definition of Done

- [ ] All new DB tables present and migrations run cleanly
- [ ] Public API: same response shapes, now sourced from DB where applicable
- [ ] Admin can CRUD: rules, events, changelog, announcements, faq, server-info, wipe-info
- [ ] Admin can configure: general, dashboard, server, tickets, roles, channels, ai, streamer, whitelist, moderation, design, security, system
- [ ] Admin overview shows public hub status + quick actions
- [ ] Public Preview page works
- [ ] Content Editor permission level works (can edit content, can't change settings)
- [ ] All write operations audit-logged
- [ ] Secrets never returned in clear-text
- [ ] No fake/hardcoded counts anywhere — empty states for missing data
- [ ] TypeScript build: zero errors
- [ ] All tests pass
- [ ] Admin dashboard fully functional
- [ ] Public dashboard fully functional
- [ ] No console errors in browser
