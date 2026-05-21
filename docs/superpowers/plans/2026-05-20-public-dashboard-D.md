# Public User Dashboard (Sub-project D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-facing Discord-authenticated dashboard at `/public` on the existing port 3000, where any guild member can log in to see server analytics and their own tickets.

**Architecture:** New session namespace `req.session.publicUser` is completely separate from the admin `req.session.user`. Public API routes live at `/public-api/*` and are guarded by a new `requirePublicAuth` middleware. Static files served from `dashboard/public-user/`. Guild membership is verified via the bot cache — no extra OAuth scope required.

**Tech Stack:** TypeScript, Express 4.x, better-sqlite3, express-session (shared SQLite store, separate session key), Discord OAuth2 (plain fetch, no Passport), Vanilla JS SPA, Chart.js 4.x CDN.

---

## File Map

| File | Action |
|---|---|
| `src/config/env.ts` | Modify — add `PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL` |
| `.env` | Modify — add new env var |
| `src/dashboard/auth/middleware.ts` | Modify — add `publicUser` to session type augmentation |
| `src/dashboard/auth/public-middleware.ts` | Create — `requirePublicAuth` middleware |
| `src/dashboard/routes/auth.routes.ts` | Modify — add 3 public OAuth routes |
| `src/dashboard/routes/public-api/index.ts` | Create — public API router |
| `src/dashboard/routes/public-api/overview.ts` | Create — `/public-api/overview` |
| `src/dashboard/routes/public-api/analytics.ts` | Create — 6 analytics endpoints |
| `src/dashboard/routes/public-api/tickets.ts` | Create — `/public-api/tickets/mine` |
| `src/dashboard/server.ts` | Modify — mount public API + static |
| `dashboard/public-user/login.html` | Create |
| `dashboard/public-user/index.html` | Create |
| `dashboard/public-user/css/dashboard.css` | Copy from `dashboard/public/css/dashboard.css` |
| `dashboard/public-user/js/api.js` | Create |
| `dashboard/public-user/js/charts.js` | Copy from `dashboard/public/js/charts.js` |
| `dashboard/public-user/js/app.js` | Create |
| `dashboard/public-user/js/pages/overview.js` | Create |
| `dashboard/public-user/js/pages/analytics.js` | Create |
| `dashboard/public-user/js/pages/tickets.js` | Create |

---

## Task 1: ENV var + session type

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/dashboard/auth/middleware.ts`
- Modify: `.env`

- [ ] **Step 1: Add env var to env.ts**

In `src/config/env.ts`, add after `DISCORD_OAUTH_CALLBACK_URL`:

```typescript
  PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL: process.env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/public/callback',
```

The full relevant block in `env.ts` (lines 62–63 area) should read:

```typescript
  DISCORD_CLIENT_SECRET:                   process.env.DISCORD_CLIENT_SECRET ?? '',
  DISCORD_OAUTH_CALLBACK_URL:              process.env.DISCORD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/callback',
  PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL:     process.env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/public/callback',
  DASHBOARD_ALLOWED_USER_IDS:              envList('DASHBOARD_ALLOWED_USER_IDS'),
```

- [ ] **Step 2: Add publicUser to session type augmentation in middleware.ts**

In `src/dashboard/auth/middleware.ts`, update the `declare module 'express-session'` block (currently lines 26–31) to:

```typescript
declare module 'express-session' {
  interface SessionData {
    user?:        DashboardUser;
    oauthState?:  string;
    publicUser?: {
      userId:   string;
      username: string;
      avatar:   string | null;
      guildId:  string;
    };
  }
}
```

- [ ] **Step 3: Add env var to .env**

Append to `.env`:

```
PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL=http://134.255.234.11:3000/auth/public/callback
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:\Users\Administrator\Desktop\sectorbot
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/dashboard/auth/middleware.ts .env
git commit -m "feat(public-dashboard): add PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL env + session type"
```

---

## Task 2: requirePublicAuth middleware

**Files:**
- Create: `src/dashboard/auth/public-middleware.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/auth/public-middleware.ts`:

```typescript
// src/dashboard/auth/public-middleware.ts
// Auth middleware for the public user dashboard (/public-api/*).
// Uses req.session.publicUser — completely separate from admin req.session.user.

import type { Request, Response, NextFunction } from 'express';

/**
 * Require a publicUser session.
 * - API requests (baseUrl starts with /public-api, or Accept: application/json) → 401 JSON
 * - Page requests → redirect to /public/login.html
 */
export function requirePublicAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.publicUser) {
    const isApi = req.baseUrl.startsWith('/public-api') || req.headers.accept?.includes('application/json');
    if (isApi) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
    } else {
      res.redirect('/public/login.html');
    }
    return;
  }
  next();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/auth/public-middleware.ts
git commit -m "feat(public-dashboard): add requirePublicAuth middleware"
```

---

## Task 3: Public OAuth routes (login / callback / logout)

**Files:**
- Modify: `src/dashboard/routes/auth.routes.ts`

- [ ] **Step 1: Add imports to auth.routes.ts**

At the top of `src/dashboard/routes/auth.routes.ts`, add after existing imports:

```typescript
import { env } from '../../config/env';
```

Note: `env` is already imported if you check — if it is, skip. Also add:

```typescript
import { logger } from '../../utils/logger';
```

Both are already imported. You need to also import `generateState` and `exchangeCode` — those are already imported too. The only new thing is using `env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL`.

- [ ] **Step 2: Add a buildPublicOAuthURL helper inside auth.routes.ts**

After the existing `buildAuthRouter` export function, add a private helper at the top of the file (before the export):

```typescript
function buildPublicOAuthURL(state: string): string {
  const params = new URLSearchParams({
    client_id:     env.CLIENT_ID,
    redirect_uri:  env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope:         'identify',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}
```

Wait — `env` is not currently imported in auth.routes.ts. Check line 1–13 of the current file. It imports from `'../auth/discord-oauth'` and `'../auth/middleware'` but NOT from `'../../config/env'`. Add that import.

- [ ] **Step 3: Add the 3 public routes inside buildAuthRouter**

Inside `buildAuthRouter`, before `return router;`, add:

```typescript
  // ─── Public OAuth (any guild member) ──────────────────────────────────────

  // GET /auth/public/login
  router.get('/public/login', (req, res) => {
    const state = generateState();
    req.session.oauthState = state;
    req.session.save((err) => {
      if (err) {
        logger.error('[public-dashboard] Session-Speicherfehler beim Public-Login:', err);
        res.status(500).send('Session error. Try again.');
        return;
      }
      res.redirect(buildPublicOAuthURL(state));
    });
  });

  // GET /auth/public/callback
  router.get('/public/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        logger.warn('[public-dashboard] OAuth denied:', error);
        res.redirect('/auth/denied?reason=oauth_denied');
        return;
      }

      if (!code || !state || state !== req.session.oauthState) {
        res.redirect('/auth/denied?reason=invalid_state');
        return;
      }

      // Exchange code for access token (scopes: identify only)
      const tokenData = await exchangeCode(
        code,
        env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL,
      );

      // Get Discord user info
      const discordUser = await fetchDiscordUser(tokenData.access_token);

      // Find the bot's first guild
      const guild = client.guilds.cache.first();
      if (!guild) {
        logger.error('[public-dashboard] Bot ist in keiner Guild.');
        res.redirect('/auth/denied?reason=no_guild');
        return;
      }

      // Verify guild membership using the bot cache (no extra OAuth scope needed)
      let member;
      try {
        member = await guild.members.fetch(discordUser.id);
      } catch {
        member = null;
      }
      if (!member) {
        logger.info(`[public-dashboard] Nicht in Guild: ${discordUser.username} (${discordUser.id})`);
        res.redirect('/auth/denied?reason=not_in_guild');
        return;
      }

      // Set public session
      req.session.oauthState = undefined;
      req.session.publicUser = {
        userId:   discordUser.id,
        username: discordUser.global_name ?? discordUser.username,
        avatar:   discordUser.avatar,
        guildId:  guild.id,
      };

      req.session.save((err) => {
        if (err) {
          logger.error('[public-dashboard] Session-Speicherfehler nach Auth:', err);
          res.status(500).send('Session error. Try again.');
          return;
        }
        logger.info(`[public-dashboard] Public Login: ${discordUser.username}`);
        res.redirect('/public/');
      });
    } catch (err) {
      logger.error('[public-dashboard] Public-Callback-Fehler:', err);
      res.redirect('/auth/denied?reason=error');
    }
  });

  // GET /auth/public/logout
  router.get('/public/logout', (req, res) => {
    const username = req.session.publicUser?.username ?? 'unknown';
    // Only clear publicUser, preserve any admin session
    req.session.publicUser = undefined;
    req.session.save((err) => {
      if (err) logger.warn('[public-dashboard] Logout-Fehler:', err);
      else logger.info(`[public-dashboard] Public Logout: ${username}`);
      res.redirect('/public/login.html');
    });
  });
```

**Important:** `exchangeCode` in `discord-oauth.ts` currently hardcodes `env.DISCORD_OAUTH_CALLBACK_URL` as the redirect_uri. You need to make it accept a redirect URI parameter.

- [ ] **Step 4: Update exchangeCode in discord-oauth.ts to accept redirect_uri parameter**

In `src/dashboard/auth/discord-oauth.ts`, change `exchangeCode` signature and body:

```typescript
/** Exchange authorization code for access token. */
export async function exchangeCode(code: string, redirectUri?: string): Promise<DiscordTokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri ?? env.DISCORD_OAUTH_CALLBACK_URL,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<DiscordTokenResponse>;
}
```

- [ ] **Step 5: Add env import to auth.routes.ts**

At the top of `src/dashboard/routes/auth.routes.ts`, add:

```typescript
import { env } from '../../config/env';
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/routes/auth.routes.ts src/dashboard/auth/discord-oauth.ts
git commit -m "feat(public-dashboard): add public OAuth routes (login/callback/logout)"
```

---

## Task 4: Public API router + /me + /overview

**Files:**
- Create: `src/dashboard/routes/public-api/index.ts`
- Create: `src/dashboard/routes/public-api/overview.ts`

- [ ] **Step 1: Create the public API router index**

Create `src/dashboard/routes/public-api/index.ts`:

```typescript
// src/dashboard/routes/public-api/index.ts
// Router for all /public-api/* endpoints.
// All routes require requirePublicAuth — applied at router level.

import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePublicAuth } from '../../auth/public-middleware';
import { publicOverviewRouter } from './overview';
import { publicAnalyticsRouter } from './analytics';
import { publicTicketsRouter } from './tickets';

export function buildPublicApiRouter(client: Client): Router {
  const router = Router();

  // All public-api routes require public session
  router.use(requirePublicAuth);

  // GET /public-api/me
  router.get('/me', (req, res) => {
    const { userId, username, avatar, guildId } = req.session.publicUser!;
    res.json({ success: true, data: { userId, username, avatar, guildId } });
  });

  router.use('/overview',  publicOverviewRouter(client));
  router.use('/analytics', publicAnalyticsRouter);
  router.use('/tickets',   publicTicketsRouter);

  return router;
}
```

- [ ] **Step 2: Create overview route**

Create `src/dashboard/routes/public-api/overview.ts`:

```typescript
// src/dashboard/routes/public-api/overview.ts
// GET /public-api/overview
// Returns SCUM server status, guild info, and 24h activity aggregates.
// No bot internals (no latency, uptime, guild count).

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getLatestServerStatus,
  getMessagesTotal,
  getVoiceTotal,
} from '../../../analytics/analytics.db';

export function publicOverviewRouter(client: Client): Router {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const guildId  = req.session.publicUser!.guildId;
      const since24h = Math.floor(Date.now() / 1000) - 86400;

      const guild = client.guilds.cache.get(guildId) ?? client.guilds.cache.first();

      const latestStatus = getLatestServerStatus(guildId);
      const scumServer = latestStatus ? {
        online:        latestStatus.online === 1,
        playersOnline: latestStatus.players_online,
        maxPlayers:    latestStatus.max_players,
        ping:          latestStatus.ping,
        lastCheck:     latestStatus.checked_at,
      } : null;

      const guildInfo = guild ? {
        name:        guild.name,
        memberCount: guild.memberCount,
      } : null;

      const activity = {
        messages:  getMessagesTotal(guildId, since24h),
        voiceSecs: getVoiceTotal(guildId, since24h),
      };

      res.json({ success: true, data: { scumServer, guild: guildInfo, activity } });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/routes/public-api/index.ts src/dashboard/routes/public-api/overview.ts
git commit -m "feat(public-dashboard): add public API router + /me + /overview"
```

---

## Task 5: Public analytics routes

**Files:**
- Create: `src/dashboard/routes/public-api/analytics.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/public-api/analytics.ts`:

```typescript
// src/dashboard/routes/public-api/analytics.ts
// Public analytics endpoints — same data as admin analytics, no per-user fields.
// Reuses existing analytics DB functions; no new queries needed.

import { Router } from 'express';
import {
  getMessagesByDay, getMessagesByChannel, getMessagesTotal,
  getVoiceByDay, getVoiceByChannel, getVoiceTotal, getStreamTotal,
  getMemberEventsByDay,
  getAiByDay, getAiByFeature, getAiTotal,
  getServerStatusHistory, getPeakPlayers,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';

function parsePeriod(period?: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (!period)          return now - 7 * 86400;
  if (period === '24h') return now - 86400;
  if (period === '7d')  return now - 7  * 86400;
  if (period === '30d') return now - 30 * 86400;
  if (period === '90d') return now - 90 * 86400;
  if (period === 'all') return 0;
  const days = parseInt(period);
  if (!isNaN(days) && days > 0) return now - days * 86400;
  return now - 7 * 86400;
}

export const publicAnalyticsRouter = Router();

publicAnalyticsRouter.get('/messages', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getMessagesByDay(guildId, since), byChannel: getMessagesByChannel(guildId, since), total: getMessagesTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/voice', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getVoiceByDay(guildId, since), byChannel: getVoiceByChannel(guildId, since), totalSeconds: getVoiceTotal(guildId, since), totalStreamSeconds: getStreamTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/growth', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getMemberEventsByDay(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/tickets', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const since   = parsePeriod(req.query.period as string);
    const db      = getDb();
    const total   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ?`).get(guildId) as { n: number }).n;
    const open    = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId) as { n: number }).n;
    const closed  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;
    const byCategory = db.prepare(`SELECT category, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY category ORDER BY count DESC`).all(guildId, since) as Array<{ category: string; count: number }>;
    const byDay      = db.prepare(`SELECT (COALESCE(closed_at, created_at) / 86400) * 86400 AS date_ts, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY date_ts ORDER BY date_ts`).all(guildId, since) as Array<{ date_ts: number; count: number }>;
    const avgRow     = db.prepare(`SELECT AVG(closed_at - created_at) AS avg_secs FROM tickets WHERE guild_id = ? AND status = 'closed' AND closed_at IS NOT NULL AND COALESCE(closed_at, created_at) >= ?`).get(guildId, since) as { avg_secs: number | null };
    res.json({ success: true, data: { total, open, closed, byCategory, byDay, avgResolutionSecs: avgRow.avg_secs, since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/server-status', (req, res) => {
  try {
    const guildId   = req.session.publicUser!.guildId;
    const since     = parsePeriod(req.query.period as string);
    const history   = getServerStatusHistory(guildId, since, 500);
    const peak      = getPeakPlayers(guildId, since);
    const total     = history.length;
    const onlineCnt = history.filter(r => r.online === 1).length;
    const uptimePct = total > 0 ? Math.round((onlineCnt / total) * 100) : null;
    res.json({ success: true, data: { history, peak, uptimePct, since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/ai', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byFeature: getAiByFeature(guildId, since), byDay: getAiByDay(guildId, since), total: getAiTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/routes/public-api/analytics.ts
git commit -m "feat(public-dashboard): add public analytics routes (6 endpoints)"
```

---

## Task 6: Public tickets routes (own tickets only)

**Files:**
- Create: `src/dashboard/routes/public-api/tickets.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/public-api/tickets.ts`:

```typescript
// src/dashboard/routes/public-api/tickets.ts
// GET /public-api/tickets/mine       — list user's own tickets
// GET /public-api/tickets/mine/:id   — single ticket (ownership enforced at DB level)
//
// Security: opener_user_id filter applied in SQL, not in application code.
// A user cannot read another user's ticket by guessing an ID.

import { Router } from 'express';
import { getDb } from '../../../db/index';

export const publicTicketsRouter = Router();

// GET /public-api/tickets/mine?status=open|closed|all&page=1&search=
publicTicketsRouter.get('/mine', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const userId  = req.session.publicUser!.userId;
    const status  = (req.query.status as string) ?? 'all';
    const page    = Math.max(1, parseInt(req.query.page as string) || 1);
    const search  = ((req.query.search as string) ?? '').trim();
    const limit   = 25;
    const offset  = (page - 1) * limit;
    const db      = getDb();

    let whereStatus = '';
    if (status === 'open')   whereStatus = `AND status = 'open'`;
    if (status === 'closed') whereStatus = `AND status = 'closed'`;

    let whereSearch = '';
    const params: unknown[] = [guildId, userId];
    if (search) {
      whereSearch = `AND (category LIKE ? OR username_snapshot LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const baseWhere = `WHERE guild_id = ? AND opener_user_id = ? ${whereStatus} ${whereSearch}`;

    const total   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets ${baseWhere}`).get(...params) as { n: number }).n;
    const tickets = db.prepare(
      `SELECT id, guild_id, status, category, created_at, closed_at, summary, username_snapshot, closed_by_username_snapshot
       FROM tickets ${baseWhere}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ success: true, data: { tickets, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// GET /public-api/tickets/mine/:id
publicTicketsRouter.get('/mine/:id', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const userId  = req.session.publicUser!.userId;
    const id      = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }
    const db     = getDb();
    const ticket = db.prepare(
      `SELECT id, guild_id, status, category, created_at, closed_at, summary, username_snapshot, closed_by_username_snapshot
       FROM tickets
       WHERE id = ? AND guild_id = ? AND opener_user_id = ?`
    ).get(id, guildId, userId);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/routes/public-api/tickets.ts
git commit -m "feat(public-dashboard): add public tickets routes (own tickets only, DB-level ownership)"
```

---

## Task 7: Wire public API + static into server.ts

**Files:**
- Modify: `src/dashboard/server.ts`

- [ ] **Step 1: Add imports at top of server.ts**

In `src/dashboard/server.ts`, add after existing imports:

```typescript
import { buildPublicApiRouter } from './routes/public-api/index';
```

- [ ] **Step 2: Mount public API and static files**

In `src/dashboard/server.ts`, find the block that starts with `// Static files: HTML/CSS/JS from dashboard/public/` (line ~62). Insert the following BEFORE the existing `app.use(express.static(PUBLIC_DIR));` line:

```typescript
  // Public user API (must come before /public static middleware)
  app.use('/public-api', buildPublicApiRouter(client));

  // Public user static files
  const PUBLIC_USER_DIR = join(process.cwd(), 'dashboard', 'public-user');
  app.use('/public', express.static(PUBLIC_USER_DIR));

  // SPA fallback for /public/* paths (client-side routing)
  app.get('/public/*', (_req, res) => {
    res.sendFile('index.html', { root: PUBLIC_USER_DIR }, (err) => {
      if (err) res.status(404).send('Public dashboard not found.');
    });
  });
```

The final order in server.ts should be:
1. `/auth` routes
2. `/api` admin routes
3. `/public-api` public routes  ← new
4. `/public` static             ← new
5. `/public/*` SPA fallback     ← new
6. admin static (`dashboard/public/`)
7. admin SPA fallback `*`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/server.ts
git commit -m "feat(public-dashboard): wire public API + static into server.ts"
```

---

## Task 8: Frontend — login.html + index.html + CSS

**Files:**
- Create: `dashboard/public-user/login.html`
- Create: `dashboard/public-user/index.html`
- Copy: `dashboard/public-user/css/dashboard.css`

- [ ] **Step 1: Copy CSS**

```bash
mkdir -p dashboard/public-user/css
cp dashboard/public/css/dashboard.css dashboard/public-user/css/dashboard.css
```

- [ ] **Step 2: Create login.html**

Create `dashboard/public-user/login.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — SECTOR 13 Community</title>
  <link rel="stylesheet" href="/public/css/dashboard.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 360px;
      text-align: center;
    }
    .login-logo {
      width: 56px; height: 56px;
      background: var(--accent);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 900; color: #fff;
      margin: 0 auto 1.25rem;
    }
    .login-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .login-sub   { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.75rem; }
    .discord-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
      width: 100%;
      background: #5865f2;
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 0.7rem 1rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }
    .discord-btn:hover { background: #4752c4; text-decoration: none; }
    .login-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 1.25rem; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="login-logo">S</div>
    <div class="login-title">SECTOR 13 Community</div>
    <div class="login-sub">Community Dashboard — für alle SECTOR 13 Mitglieder</div>
    <a href="/auth/public/login" class="discord-btn">
      <svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5 0.5a40 40 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0 40 40 0 0 0-1.8-3.7A58.3 58.3 0 0 0 11 4.9C1.6 19 -1 32.8 0.3 46.4a58.9 58.9 0 0 0 17.9 9 44.1 44.1 0 0 0 3.8-6.2 38.3 38.3 0 0 1-6-2.9l1.5-1.1a41.9 41.9 0 0 0 36 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.5 44.5 0 0 0 3.8 6.2 58.7 58.7 0 0 0 17.9-9C72 32.2 68.8 18.5 60.1 4.9zM23.7 38a6.7 6.7 0 0 1-6.3-7 6.7 6.7 0 0 1 6.3-7 6.7 6.7 0 0 1 6.3 7 6.7 6.7 0 0 1-6.3 7zm23.6 0a6.7 6.7 0 0 1-6.3-7 6.7 6.7 0 0 1 6.3-7 6.7 6.7 0 0 1 6.3 7 6.7 6.7 0 0 1-6.3 7z"/>
      </svg>
      Mit Discord anmelden
    </a>
    <p class="login-note">Nur für SECTOR 13 Discord-Mitglieder.<br>Deine Session läuft nach 24h ab.</p>
  </div>
</body>
</html>
```

- [ ] **Step 3: Create index.html**

Create `dashboard/public-user/index.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SECTOR 13 Community</title>
  <link rel="stylesheet" href="/public/css/dashboard.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<div id="app">
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">S</div>
      <div>
        <div class="logo-text">SECTOR 13</div>
        <div class="logo-sub">Community</div>
      </div>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      <div class="nav-section">Übersicht</div>
      <div class="nav-item" data-page="overview">
        <span class="nav-icon">⬡</span> Overview
      </div>

      <div class="nav-section">Server Analytics</div>
      <div class="nav-item" data-page="analytics">
        <span class="nav-icon">📈</span> Analytics
      </div>

      <div class="nav-section">Mein Bereich</div>
      <div class="nav-item" data-page="tickets">
        <span class="nav-icon">🎫</span> Meine Tickets
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="bot-status">
        <div class="status-dot" id="bot-status-dot"></div>
        <span id="bot-status-text">Verbinde...</span>
      </div>
    </div>
  </aside>

  <!-- Main area -->
  <main class="main">
    <header class="topbar">
      <div class="topbar-title" id="page-title">Overview</div>
      <div class="topbar-right">
        <div class="topbar-user">
          <img class="topbar-avatar" id="user-avatar" src="" alt="" onerror="this.style.display='none'">
          <span id="user-name">—</span>
        </div>
        <a href="/auth/public/logout" class="btn btn-ghost" style="font-size:0.75rem;padding:0.3rem 0.6rem;">Logout</a>
      </div>
    </header>

    <div class="page-content" id="page-content">
      <div class="empty-state">
        <div class="empty-icon">⬡</div>
        <p>Lade Dashboard...</p>
      </div>
    </div>
  </main>
</div>

<div id="toast-container"></div>

<script src="/public/js/api.js"></script>
<script src="/public/js/charts.js"></script>
<script src="/public/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/public-user/
git commit -m "feat(public-dashboard): add login.html, index.html, copy CSS"
```

---

## Task 9: Frontend — api.js + charts.js + app.js

**Files:**
- Create: `dashboard/public-user/js/api.js`
- Copy: `dashboard/public-user/js/charts.js`
- Create: `dashboard/public-user/js/app.js`

- [ ] **Step 1: Copy charts.js**

```bash
mkdir -p dashboard/public-user/js/pages
cp dashboard/public/js/charts.js dashboard/public-user/js/charts.js
```

- [ ] **Step 2: Create api.js**

Create `dashboard/public-user/js/api.js`:

```javascript
// dashboard/public-user/js/api.js
// Fetch wrappers for /public-api/* routes.
// On 401 → redirect to /public/login.html.

const API = {
  async _fetch(url, options = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...options });
    if (res.status === 401) {
      window.location.href = '/public/login.html';
      throw new Error('Unauthenticated');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async get(path) { return this._fetch('/public-api' + path); },

  // Convenience methods
  me:            () => API.get('/me'),
  overview:      () => API.get('/overview'),
  messages:      (p) => API.get(`/analytics/messages?period=${p}`),
  voice:         (p) => API.get(`/analytics/voice?period=${p}`),
  growth:        (p) => API.get(`/analytics/growth?period=${p}`),
  tickets:       (p) => API.get(`/analytics/tickets?period=${p}`),
  statusHistory: (p) => API.get(`/analytics/server-status?period=${p}`),
  ai:            (p) => API.get(`/analytics/ai?period=${p}`),
  myTickets:     (q) => API.get(`/tickets/mine?${new URLSearchParams(q)}`),
  myTicket:      (id) => API.get(`/tickets/mine/${id}`),
};

window.API = API;
```

- [ ] **Step 3: Create app.js**

Create `dashboard/public-user/js/app.js`:

```javascript
// dashboard/public-user/js/app.js
// Router, navigation, toast, global helpers for the public user dashboard.

window.AppState = { user: null };

const PAGE_TITLES = {
  'overview':  'Übersicht',
  'analytics': 'Server Analytics',
  'tickets':   'Meine Tickets',
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, level = 'info', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
window.toast = toast;

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyState(message = 'Noch keine Daten vorhanden.') {
  return `<div class="empty-state"><div class="empty-icon">◌</div><p>${message}</p></div>`;
}
function loadingState() {
  return `<div class="card"><div class="skeleton" style="height:200px"></div></div>`;
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function errorState(err) {
  return `<div class="empty-state"><div class="empty-icon" style="color:var(--offline)">✕</div><p>Fehler: ${escapeHtml(err)}</p></div>`;
}
window.emptyState   = emptyState;
window.loadingState = loadingState;
window.errorState   = errorState;
window.escapeHtml   = escapeHtml;

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1) + 'k';
  return String(n);
}
window.fmt = fmt;

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
window.fmtDate = fmtDate;

// ── Period selector ───────────────────────────────────────────────────────────
function periodBar(current, onChange) {
  const periods = ['24h','7d','30d','90d','all'];
  const html = `<div class="period-bar">${periods.map(p =>
    `<button class="period-btn${p===current?' active':''}" data-period="${p}">${p}</button>`
  ).join('')}</div>`;
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === btn.dataset.period));
      onChange(btn.dataset.period);
    });
  });
  return div;
}
window.periodBar = periodBar;

// ── Navigation ────────────────────────────────────────────────────────────────
const _loadedScripts = new Set();

function loadScript(src) {
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload  = () => { _loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error(`Script ${src} konnte nicht geladen werden`));
    document.head.appendChild(s);
  });
}

async function navigateTo(page) {
  if (!Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    document.getElementById('page-content').innerHTML = emptyState('Seite nicht gefunden.');
    return;
  }
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] ?? page;
  document.title = `${PAGE_TITLES[page] ?? page} — SECTOR 13`;
  history.pushState(null, '', '#/' + page);

  const content = document.getElementById('page-content');
  content.innerHTML = loadingState();

  try {
    const moduleId = 'page-' + page;
    if (!window[moduleId]) {
      await loadScript(`/public/js/pages/${page}.js`);
    }
    const pageModule = window[moduleId];
    if (pageModule?.render) {
      await pageModule.render(content);
    } else {
      content.innerHTML = emptyState(`Seite "${page}" nicht gefunden.`);
    }
  } catch (err) {
    content.innerHTML = errorState(err.message);
  }
}

document.getElementById('sidebar-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (item?.dataset.page) navigateTo(item.dataset.page);
});

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'overview';
  navigateTo(page);
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const { data: user } = await API.me();
    window.AppState.user = user;

    document.getElementById('user-name').textContent = escapeHtml(user.username);
    if (user.avatar) {
      const avatarEl = document.getElementById('user-avatar');
      avatarEl.src = `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.userId)}/${encodeURIComponent(user.avatar)}.png?size=64`;
    }

    const dot = document.getElementById('bot-status-dot');
    const txt = document.getElementById('bot-status-text');
    dot.classList.add('online');
    txt.textContent = 'Online';

    const hash = window.location.hash.replace('#/', '') || 'overview';
    await navigateTo(hash);
  } catch (err) {
    if (err.message === 'Unauthenticated') return;
    console.error('Init error:', err);
    const content = document.getElementById('page-content');
    if (content) content.innerHTML = errorState('Verbindung zum Server fehlgeschlagen. Bitte Seite neu laden.');
  }
}

init();
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/public-user/js/
git commit -m "feat(public-dashboard): add api.js, charts.js, app.js"
```

---

## Task 10: overview.js page

**Files:**
- Create: `dashboard/public-user/js/pages/overview.js`

- [ ] **Step 1: Create the file**

Create `dashboard/public-user/js/pages/overview.js`:

```javascript
// dashboard/public-user/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Übersicht</h1><p>SECTOR 13 Server- und Community-Status auf einen Blick.</p></div>
      <div id="overview-content">
        <div class="card"><div class="skeleton" style="height:120px"></div></div>
      </div>
    `;
    try {
      const { data } = await API.overview();
      const { scumServer, guild, activity } = data;

      const serverCard = scumServer ? `
        <div class="card">
          <div class="card-title">SCUM Server</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Status</div>
              <div class="stat-value">
                <span class="status-badge ${scumServer.online ? 'online' : 'offline'}">
                  ${scumServer.online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Spieler</div>
              <div class="stat-value">${escapeHtml(String(scumServer.playersOnline ?? 0))} / ${escapeHtml(String(scumServer.maxPlayers ?? 64))}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Ping</div>
              <div class="stat-value">${escapeHtml(String(scumServer.ping ?? '—'))} ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Letzter Check</div>
              <div class="stat-value" style="font-size:.85rem">${fmtDate(scumServer.lastCheck)}</div>
            </div>
          </div>
        </div>
      ` : `<div class="card"><p style="color:var(--text-muted)">Keine Serverdaten verfügbar.</p></div>`;

      const guildCard = guild ? `
        <div class="card">
          <div class="card-title">Discord Server</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Server</div>
              <div class="stat-value" style="font-size:1rem">${escapeHtml(guild.name)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Mitglieder</div>
              <div class="stat-value">${fmt(guild.memberCount)}</div>
            </div>
          </div>
        </div>
      ` : '';

      const activityCard = `
        <div class="card">
          <div class="card-title">Aktivität (letzte 24h)</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Nachrichten</div>
              <div class="stat-value">${fmt(activity.messages)}</div>
              <div class="stat-sub">heute</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Voice Zeit</div>
              <div class="stat-value">${fmt(Math.round((activity.voiceSecs ?? 0) / 60))}</div>
              <div class="stat-sub">Minuten heute</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('overview-content').innerHTML = serverCard + guildCard + activityCard;
    } catch (err) {
      document.getElementById('overview-content').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/public-user/js/pages/overview.js
git commit -m "feat(public-dashboard): add overview.js page"
```

---

## Task 11: analytics.js page (6 tabs)

**Files:**
- Create: `dashboard/public-user/js/pages/analytics.js`

- [ ] **Step 1: Create the file**

Create `dashboard/public-user/js/pages/analytics.js`:

```javascript
// dashboard/public-user/js/pages/analytics.js
// Tab-based analytics page with 6 tabs: Nachrichten, Voice, Wachstum, Tickets, Server, AI

window['page-analytics'] = {
  activeTab: 'messages',
  periods: { messages: '7d', voice: '7d', growth: '7d', tickets: '7d', server: '7d', ai: '7d' },

  async render(container) {
    const self = this;
    const tabs = [
      { id: 'messages', label: 'Nachrichten' },
      { id: 'voice',    label: 'Voice' },
      { id: 'growth',   label: 'Wachstum' },
      { id: 'tickets',  label: 'Tickets' },
      { id: 'server',   label: 'Server' },
      { id: 'ai',       label: 'AI' },
    ];

    container.innerHTML = `
      <div class="page-header"><h1>Server Analytics</h1><p>Aggregierte Serverstatistiken für alle Mitglieder.</p></div>
      <div class="tab-bar" id="analytics-tabs">
        ${tabs.map(t => `<button class="tab-btn${t.id === self.activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="analytics-body"></div>
    `;

    container.querySelector('#analytics-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      self.activeTab = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === self.activeTab));
      self.loadTab(self.activeTab);
    });

    await self.loadTab(self.activeTab);
  },

  async loadTab(tab) {
    const self = this;
    const body = document.getElementById('analytics-body');
    if (!body) return;
    const period = self.periods[tab] ?? '7d';

    if (tab === 'messages') await self.loadMessages(body, period);
    else if (tab === 'voice')   await self.loadVoice(body, period);
    else if (tab === 'growth')  await self.loadGrowth(body, period);
    else if (tab === 'tickets') await self.loadTickets(body, period);
    else if (tab === 'server')  await self.loadServer(body, period);
    else if (tab === 'ai')      await self.loadAi(body, period);
  },

  _periodBar(tab, body) {
    const self = this;
    const pb = periodBar(self.periods[tab], (p) => {
      self.periods[tab] = p;
      self.loadTab(tab);
    });
    body.prepend(pb);
  },

  async loadMessages(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="msg-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nachrichten pro Tag</div><div style="height:220px"><canvas id="msg-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="msg-channel-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('messages', body);
    try {
      const { data } = await API.messages(period);
      const { byDay, byChannel, total } = data;
      document.getElementById('msg-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">${period}</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${byChannel.length}</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? fmt(Math.round(total / byDay.length)) : '—'}</div></div>
      `;
      const dailyWrap = document.getElementById('msg-daily-chart')?.parentElement;
      const chanWrap  = document.getElementById('msg-channel-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="msg-daily-chart"></canvas>'; Charts.lineChart('msg-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Nachrichten', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byChannel.length === 0) { chanWrap.innerHTML = emptyState(); }
      else { chanWrap.innerHTML = '<canvas id="msg-channel-chart"></canvas>'; Charts.barChart('msg-channel-chart', byChannel.slice(0,10).map(r => r.channel_id.slice(-6)), byChannel.slice(0,10).map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadVoice(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="voice-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Voice-Minuten pro Tag</div><div style="height:220px"><canvas id="voice-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="voice-channel-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('voice', body);
    try {
      const { data } = await API.voice(period);
      const { byDay, byChannel, totalSeconds } = data;
      document.getElementById('voice-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(Math.round(totalSeconds / 60))}</div><div class="stat-sub">Minuten</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${byChannel.length}</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? fmt(Math.round(totalSeconds / 60 / byDay.length)) : '—'}</div><div class="stat-sub">Minuten</div></div>
      `;
      const dailyWrap = document.getElementById('voice-daily-chart')?.parentElement;
      const chanWrap  = document.getElementById('voice-channel-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="voice-daily-chart"></canvas>'; Charts.lineChart('voice-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Minuten', data: byDay.map(r => Math.round(r.total_seconds / 60)), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byChannel.length === 0) { chanWrap.innerHTML = emptyState(); }
      else { chanWrap.innerHTML = '<canvas id="voice-channel-chart"></canvas>'; Charts.barChart('voice-channel-chart', byChannel.slice(0,8).map(r => r.channel_id.slice(-6)), byChannel.slice(0,8).map(r => Math.round(r.total_seconds / 60))); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadGrowth(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="growth-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Mitgliederentwicklung</div><div style="height:260px"><canvas id="growth-chart"></canvas></div></div>
    `;
    self._periodBar('growth', body);
    try {
      const { data } = await API.growth(period);
      const { byDay } = data;
      const joins  = byDay.reduce((s, r) => s + (r.joins  ?? 0), 0);
      const leaves = byDay.reduce((s, r) => s + (r.leaves ?? 0), 0);
      document.getElementById('growth-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Beitritte</div><div class="stat-value">${fmt(joins)}</div><div class="stat-sub">${period}</div></div>
        <div class="stat-card"><div class="stat-label">Abgänge</div><div class="stat-value">${fmt(leaves)}</div><div class="stat-sub">${period}</div></div>
        <div class="stat-card"><div class="stat-label">Netto</div><div class="stat-value">${joins - leaves >= 0 ? '+' : ''}${fmt(joins - leaves)}</div></div>
      `;
      const wrap = document.getElementById('growth-chart')?.parentElement;
      if (byDay.length === 0) { wrap.innerHTML = emptyState(); }
      else {
        wrap.innerHTML = '<canvas id="growth-chart"></canvas>';
        Charts.lineChart('growth-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [
          { label: 'Beitritte', data: byDay.map(r => r.joins ?? 0),  borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',  tension: 0.3, fill: true },
          { label: 'Abgänge',   data: byDay.map(r => r.leaves ?? 0), borderColor: '#ed4245', backgroundColor: 'rgba(237,66,69,0.1)', tension: 0.3, fill: true },
        ]);
      }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadTickets(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="ticket-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Tickets pro Tag</div><div style="height:220px"><canvas id="ticket-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Kategorie</div><div style="height:220px"><canvas id="ticket-cat-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('tickets', body);
    try {
      const { data } = await API.tickets(period);
      const { total, open, closed, byDay, byCategory } = data;
      document.getElementById('ticket-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(total)}</div></div>
        <div class="stat-card"><div class="stat-label">Offen</div><div class="stat-value">${fmt(open)}</div></div>
        <div class="stat-card"><div class="stat-label">Geschlossen</div><div class="stat-value">${fmt(closed)}</div></div>
      `;
      const dailyWrap = document.getElementById('ticket-daily-chart')?.parentElement;
      const catWrap   = document.getElementById('ticket-cat-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="ticket-daily-chart"></canvas>'; Charts.lineChart('ticket-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Tickets', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byCategory.length === 0) { catWrap.innerHTML = emptyState(); }
      else { catWrap.innerHTML = '<canvas id="ticket-cat-chart"></canvas>'; Charts.barChart('ticket-cat-chart', byCategory.map(r => escapeHtml(r.category)), byCategory.map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadServer(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="server-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Spieler Online (Verlauf)</div><div style="height:260px"><canvas id="server-chart"></canvas></div></div>
    `;
    self._periodBar('server', body);
    try {
      const { data } = await API.statusHistory(period);
      const { history, peak, uptimePct } = data;
      document.getElementById('server-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Peak Spieler</div><div class="stat-value">${fmt(peak?.players_online ?? 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${uptimePct != null ? uptimePct + '%' : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Checks</div><div class="stat-value">${fmt(history.length)}</div></div>
      `;
      const wrap = document.getElementById('server-chart')?.parentElement;
      if (history.length === 0) { wrap.innerHTML = emptyState(); }
      else {
        wrap.innerHTML = '<canvas id="server-chart"></canvas>';
        Charts.lineChart('server-chart',
          history.map(r => Charts.fmtDay(r.checked_at)),
          [{ label: 'Spieler', data: history.map(r => r.online ? r.players_online : null), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.1, fill: true, spanGaps: false }]);
      }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadAi(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="ai-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">AI Anfragen pro Tag</div><div style="height:220px"><canvas id="ai-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Feature</div><div style="height:220px"><canvas id="ai-feature-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('ai', body);
    try {
      const { data } = await API.ai(period);
      const { byDay, byFeature, total } = data;
      document.getElementById('ai-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">Anfragen</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? fmt(Math.round(total / byDay.length)) : '—'}</div></div>
      `;
      const dailyWrap   = document.getElementById('ai-daily-chart')?.parentElement;
      const featureWrap = document.getElementById('ai-feature-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="ai-daily-chart"></canvas>'; Charts.lineChart('ai-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Anfragen', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byFeature.length === 0) { featureWrap.innerHTML = emptyState(); }
      else { featureWrap.innerHTML = '<canvas id="ai-feature-chart"></canvas>'; Charts.barChart('ai-feature-chart', byFeature.map(r => escapeHtml(r.feature)), byFeature.map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },
};
```

Note: The CSS classes `tab-bar` and `tab-btn` may not exist in the copied `dashboard.css`. If they don't, add them inline in `index.html` under a `<style>` tag:

```css
.tab-bar { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1rem 0; }
.tab-btn { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .4rem .9rem; color: var(--text-muted); cursor: pointer; font-size: .85rem; transition: all .15s; }
.tab-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.tab-btn:hover:not(.active) { border-color: var(--accent); color: var(--text); }
```

Add these styles to `dashboard/public-user/index.html` in the `<head>` section after the CSS link.

- [ ] **Step 2: Commit**

```bash
git add dashboard/public-user/js/pages/analytics.js dashboard/public-user/index.html
git commit -m "feat(public-dashboard): add analytics.js page (6 tabs) + tab CSS"
```

---

## Task 12: tickets.js page (Meine Tickets)

**Files:**
- Create: `dashboard/public-user/js/pages/tickets.js`

- [ ] **Step 1: Create the file**

Create `dashboard/public-user/js/pages/tickets.js`:

```javascript
// dashboard/public-user/js/pages/tickets.js
// Shows the logged-in user's own tickets with status filter, search, and detail modal.

window['page-tickets'] = {
  status: 'all',
  page:   1,
  search: '',
  _searchTimeout: null,

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Meine Tickets</h1><p>Alle Support-Tickets die du erstellt hast.</p></div>
      <div class="toolbar" style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">
        <select id="ticket-status-filter" class="select" style="width:auto">
          <option value="all">Alle</option>
          <option value="open">Offen</option>
          <option value="closed">Geschlossen</option>
        </select>
        <input id="ticket-search" type="text" class="input" placeholder="Suche…" style="flex:1;min-width:160px;max-width:280px" value="">
      </div>
      <div id="ticket-table-wrap"></div>
      <div id="ticket-pagination" style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap"></div>

      <!-- Modal -->
      <div id="ticket-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:2rem;max-width:640px;width:90%;max-height:80vh;overflow-y:auto;position:relative">
          <button id="modal-close" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer">✕</button>
          <div id="modal-body"></div>
        </div>
      </div>
    `;

    document.getElementById('ticket-status-filter').value = self.status;
    document.getElementById('ticket-search').value = self.search;

    document.getElementById('ticket-status-filter').addEventListener('change', (e) => {
      self.status = e.target.value;
      self.page   = 1;
      self.load();
    });

    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(self._searchTimeout);
      self._searchTimeout = setTimeout(() => {
        self.search = e.target.value.trim();
        self.page   = 1;
        self.load();
      }, 350);
    });

    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('ticket-modal').style.display = 'none';
    });
    document.getElementById('ticket-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('ticket-modal')) {
        document.getElementById('ticket-modal').style.display = 'none';
      }
    });

    await self.load();
  },

  async load() {
    const self = this;
    const wrap = document.getElementById('ticket-table-wrap');
    const pag  = document.getElementById('ticket-pagination');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    try {
      const q = { status: self.status, page: self.page };
      if (self.search) q.search = self.search;
      const { data } = await API.myTickets(q);
      const { tickets, total, pages } = data;

      if (tickets.length === 0) {
        wrap.innerHTML = emptyState('Keine Tickets gefunden.');
        pag.innerHTML = '';
        return;
      }

      wrap.innerHTML = `
        <table class="data-table">
          <thead><tr>
            <th>Kategorie</th>
            <th>Status</th>
            <th>Erstellt</th>
            <th>Geschlossen</th>
            <th>Zusammenfassung</th>
          </tr></thead>
          <tbody>
            ${tickets.map(t => `
              <tr class="clickable-row" data-id="${t.id}" style="cursor:pointer">
                <td>${escapeHtml(t.category ?? '—')}</td>
                <td><span class="status-badge ${t.status === 'open' ? 'online' : 'offline'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span></td>
                <td>${fmtDate(t.created_at)}</td>
                <td>${fmtDate(t.closed_at)}</td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.summary ? t.summary.slice(0, 120) + (t.summary.length > 120 ? '…' : '') : '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      wrap.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => self.showDetail(row.dataset.id));
      });

      // Pagination
      pag.innerHTML = '';
      for (let p = 1; p <= pages; p++) {
        const btn = document.createElement('button');
        btn.className = `period-btn${p === self.page ? ' active' : ''}`;
        btn.textContent = String(p);
        btn.addEventListener('click', () => { self.page = p; self.load(); });
        pag.appendChild(btn);
      }
    } catch (err) {
      wrap.innerHTML = errorState(err.message);
    }
  },

  async showDetail(id) {
    const modal    = document.getElementById('ticket-modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    try {
      const { data: t } = await API.myTicket(id);
      modalBody.innerHTML = `
        <h2 style="margin-top:0;margin-bottom:.5rem">${escapeHtml(t.category ?? 'Ticket')} #${t.id}</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1.5rem;margin-bottom:1rem;font-size:.85rem;color:var(--text-muted)">
          <div>Status: <strong style="color:var(--text)">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</strong></div>
          <div>Erstellt: <strong style="color:var(--text)">${fmtDate(t.created_at)}</strong></div>
          ${t.closed_at ? `<div>Geschlossen: <strong style="color:var(--text)">${fmtDate(t.closed_at)}</strong></div>` : ''}
          ${t.closed_by_username_snapshot ? `<div>Geschlossen von: <strong style="color:var(--text)">${escapeHtml(t.closed_by_username_snapshot)}</strong></div>` : ''}
        </div>
        ${t.summary ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;font-size:.9rem;line-height:1.6;white-space:pre-wrap">${escapeHtml(t.summary)}</div>` : emptyState('Keine Zusammenfassung vorhanden.')}
      `;
    } catch (err) {
      modalBody.innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/public-user/js/pages/tickets.js
git commit -m "feat(public-dashboard): add tickets.js page (own tickets only, modal detail)"
```

---

## Task 13: Discord Portal redirect + .env + end-to-end verification

**Files:**
- Already updated: `.env` (Task 1 Step 3)

- [ ] **Step 1: Register redirect URL in Discord Developer Portal**

Go to: https://discord.com/developers/applications → your app → OAuth2 → Redirects

Add: `http://134.255.234.11:3000/auth/public/callback`

Click Save Changes.

- [ ] **Step 2: Build and restart the bot**

```bash
cd C:\Users\Administrator\Desktop\sectorbot
npm run build
pm2 restart scum-bot --update-env
pm2 logs scum-bot --lines 30
```

Expected in logs: `[dashboard] Dashboard läuft auf Port 3000` — no TypeScript errors, no runtime errors.

- [ ] **Step 3: Verify login flow**

- Visit `http://134.255.234.11:3000/public` — should redirect to `http://134.255.234.11:3000/public/login.html`
- Click "Mit Discord anmelden" → Discord OAuth page
- Authorize → redirected back to `/public/` → dashboard loads with Overview
- User name appears in topbar

- [ ] **Step 4: Verify session separation**

While logged into the public dashboard, try visiting `http://134.255.234.11:3000/api/me` in the same browser. Expected: `{"success":false,"error":"Not authenticated"}` (401).

Admin session is not accessible via `req.session.publicUser`.

- [ ] **Step 5: Verify tickets ownership**

Log into the public dashboard, go to "Meine Tickets". Only tickets where `opener_user_id` = your Discord ID should appear. None from other users.

- [ ] **Step 6: Verify logout**

Click Logout → redirected to `/public/login.html`. Visiting `/public/` again redirects to login (session cleared).

- [ ] **Step 7: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "feat(public-dashboard): end-to-end verification and final tweaks"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Session separation (`req.session.publicUser` vs `req.session.user`) — Task 1+2
- ✅ `requirePublicAuth` middleware with correct API detection via `req.baseUrl` — Task 2
- ✅ OAuth scopes: `identify` only for public — Task 3
- ✅ Guild membership via bot cache `guild.members.fetch()` — Task 3
- ✅ `PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL` env var — Task 1
- ✅ `/public-api/me` returns `{ userId, username, avatar, guildId }` — Task 4
- ✅ `/public-api/overview` — no bot internals, only scumServer + guild + activity — Task 4
- ✅ 6 analytics endpoints reusing existing DB functions — Task 5
- ✅ Tickets: filtered by `opener_user_id` at SQL level — Task 6
- ✅ Tickets: GET mine/:id returns 404 if wrong user — Task 6
- ✅ server.ts mount order: `/public-api` before `/public` static — Task 7
- ✅ Frontend: login.html with `/auth/public/login` button — Task 8
- ✅ Frontend: 3 nav items (overview, analytics, tickets) — Task 8
- ✅ Logout → `/auth/public/logout` (clears publicUser only, not admin session) — Task 3+8
- ✅ `escapeHtml()` used for all user-controlled strings in innerHTML — Tasks 10–12
- ✅ Analytics page with 6 tabs — Task 11
- ✅ Discord portal redirect registration reminder — Task 13

**Security constraints satisfied:**
- No secrets displayed (no API keys, tokens, internal config)
- No admin API access from public session
- No logs, audit trail, member list, or settings exposed
- No other users' tickets accessible
- XSS prevention via `escapeHtml()` on all user-controlled strings
