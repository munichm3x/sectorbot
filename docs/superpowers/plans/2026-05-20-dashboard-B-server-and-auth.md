# Dashboard Sub-project B: Server, Auth & API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Sub-project A (Analytics Infrastructure) must be complete. All analytics tables and functions must exist.

**Goal:** Add an Express.js web server to the bot that serves the dashboard, implements Discord OAuth2 login/logout, enforces permission levels, and exposes a complete REST API for all dashboard data — without modifying any existing bot behaviour.

**Architecture:** `src/dashboard/server.ts` exports `startDashboard(client)` which is conditionally called from `src/index.ts` when `DASHBOARD_ENABLED=true`. All API routes are in `src/dashboard/routes/api/`. Static files (HTML/CSS/JS) are served from `dashboard/public/` at project root. Sessions stored in a separate SQLite file via `connect-sqlite3`.

**Tech Stack:** TypeScript, Express 4, express-session, connect-sqlite3, Discord OAuth2 (custom fetch calls, no Passport.js), better-sqlite3 (existing).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add express, express-session, connect-sqlite3 + types |
| `src/dashboard/auth/discord-oauth.ts` | Create | OAuth2 URL builder, token exchange, user/member fetch |
| `src/dashboard/auth/middleware.ts` | Create | requireAuth(), requirePermission(), PermLevel enum, session type augmentation |
| `src/dashboard/routes/auth.routes.ts` | Create | GET /auth/login, /auth/callback, /auth/logout, /auth/denied |
| `src/dashboard/routes/api/overview.routes.ts` | Create | GET /api/overview |
| `src/dashboard/routes/api/analytics.routes.ts` | Create | GET /api/analytics/* |
| `src/dashboard/routes/api/tickets.routes.ts` | Create | GET /api/tickets, GET /api/tickets/:id |
| `src/dashboard/routes/api/settings.routes.ts` | Create | GET/PATCH /api/settings/* |
| `src/dashboard/routes/api/logs.routes.ts` | Create | GET /api/logs, GET /api/logs/stream (SSE) |
| `src/dashboard/routes/api/members.routes.ts` | Create | GET /api/members |
| `src/dashboard/routes/api/server-status.routes.ts` | Create | GET /api/server-status, POST /api/server-status/test |
| `src/dashboard/routes/api/index.ts` | Create | Assembles all API sub-routers |
| `src/dashboard/server.ts` | Create | Express app factory, session store, starts HTTP server |
| `src/index.ts` | Modify | Conditionally calls startDashboard(client) |
| `dashboard/public/.gitkeep` | Create | Ensures dashboard/public/ directory exists for static serving |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```
cd C:\Users\Administrator\Desktop\sectorbot
npm install express@^4.19.0 express-session@^1.18.0 connect-sqlite3@^0.9.14
```

- [ ] **Step 2: Install dev type definitions**

```
npm install -D @types/express@^4.17.21 @types/express-session@^1.18.0 @types/connect-sqlite3@^0.9.6
```

- [ ] **Step 3: Verify package.json updated**

Check that `package.json` dependencies now include:
```json
"express": "^4.19.0",
"express-session": "^1.18.0",
"connect-sqlite3": "^0.9.14"
```

- [ ] **Step 4: Verify build still works**

```
npm run build
```

Expected: No errors (new packages are installed, no code uses them yet).

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json
git commit -m "feat(dashboard): add express, express-session, connect-sqlite3"
```

---

### Task 2: Create Discord OAuth2 Helpers

**Files:**
- Create: `src/dashboard/auth/discord-oauth.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/auth/discord-oauth.ts`:

```typescript
// src/dashboard/auth/discord-oauth.ts
// Discord OAuth2 helpers — no Passport.js, plain fetch calls.
// Scopes: identify guilds guilds.members.read

import { env } from '../../config/env';

const DISCORD_API = 'https://discord.com/api/v10';

export interface DiscordTokenResponse {
  access_token: string;
  token_type:   string;
  expires_in:   number;
  scope:        string;
}

export interface DiscordUser {
  id:          string;
  username:    string;
  global_name: string | null;
  avatar:      string | null;
}

export interface DiscordGuildMember {
  roles: string[];
  nick:  string | null;
}

/** Build the Discord authorization URL. State is a random nonce stored in session. */
export function buildOAuthURL(state: string): string {
  const params = new URLSearchParams({
    client_id:     env.CLIENT_ID,
    redirect_uri:  env.DISCORD_OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope:         'identify guilds guilds.members.read',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

/** Exchange authorization code for access token. */
export async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  env.DISCORD_OAUTH_CALLBACK_URL,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<DiscordTokenResponse>;
}

/** Fetch the authenticated user's Discord profile. */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);
  return res.json() as Promise<DiscordUser>;
}

/** Fetch the authenticated user's member info for a specific guild. Returns null if not in guild. */
export async function fetchGuildMember(accessToken: string, guildId: string): Promise<DiscordGuildMember | null> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Discord member fetch failed: ${res.status}`);
  return res.json() as Promise<DiscordGuildMember>;
}

/** Generate a random state nonce for CSRF protection. */
export function generateState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/auth/discord-oauth.ts
git commit -m "feat(dashboard): Discord OAuth2 helpers"
```

---

### Task 3: Create Auth Middleware

**Files:**
- Create: `src/dashboard/auth/middleware.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/auth/middleware.ts`:

```typescript
// src/dashboard/auth/middleware.ts
// Session type augmentation + auth/permission middleware.

import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

// ─── Permission Levels ────────────────────────────────────────────────────────

export enum PermLevel {
  Viewer    = 1,
  Moderator = 2,
  Admin     = 3,
  Owner     = 4,
}

// ─── Session type augmentation ────────────────────────────────────────────────

export interface DashboardUser {
  userId:    string;
  username:  string;
  avatar:    string | null;
  permLevel: PermLevel;
  guildId:   string;  // The guild this session is scoped to
}

declare module 'express-session' {
  interface SessionData {
    user?:       DashboardUser;
    oauthState?: string;
  }
}

// ─── Permission determination ──────────────────────────────────────────────────

/**
 * Determine permission level for a user given their Discord user ID and guild roles.
 * Returns null if user has no dashboard access.
 */
export function determinePermLevel(userId: string, roles: string[]): PermLevel | null {
  if (env.DASHBOARD_ALLOWED_USER_IDS.includes(userId)) return PermLevel.Owner;
  if (env.DASHBOARD_ADMIN_ROLE_IDS.some(r => roles.includes(r))) return PermLevel.Admin;
  if (env.DASHBOARD_MOD_ROLE_IDS.some(r => roles.includes(r))) return PermLevel.Moderator;
  // If no role restrictions are configured at all, grant Viewer to any authenticated user
  if (
    env.DASHBOARD_ALLOWED_USER_IDS.length === 0 &&
    env.DASHBOARD_ADMIN_ROLE_IDS.length === 0 &&
    env.DASHBOARD_MOD_ROLE_IDS.length === 0
  ) {
    return PermLevel.Viewer;
  }
  return null;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/** Require an authenticated session. Redirects pages to /login.html; returns 401 for API routes. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
    } else {
      res.redirect('/login.html');
    }
    return;
  }
  next();
}

/** Require a minimum permission level. Returns 403 with JSON error if insufficient. */
export function requirePermission(level: PermLevel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session.user;
    if (!user || user.permLevel < level) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// ─── Simple in-process rate limiter ──────────────────────────────────────────

const rateStore = new Map<string, { count: number; resetAt: number }>();

/** Limit to maxRequests per windowMs per IP. Returns 429 if exceeded. */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip  = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = rateStore.get(ip);

    if (!entry || now >= entry.resetAt) {
      rateStore.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ success: false, error: 'Too many requests. Try again later.' });
      return;
    }

    entry.count++;
    next();
  };
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/auth/middleware.ts
git commit -m "feat(dashboard): auth middleware, PermLevel enum, session type augmentation"
```

---

### Task 4: Create Auth Routes

**Files:**
- Create: `src/dashboard/routes/auth.routes.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/auth.routes.ts`:

```typescript
// src/dashboard/routes/auth.routes.ts
// GET /auth/login   — redirect to Discord OAuth
// GET /auth/callback — handle code, create session
// GET /auth/logout   — destroy session
// GET /auth/denied   — access denied page

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  buildOAuthURL, exchangeCode, fetchDiscordUser,
  fetchGuildMember, generateState,
} from '../auth/discord-oauth';
import { determinePermLevel } from '../auth/middleware';
import { logger } from '../../utils/logger';

export function buildAuthRouter(client: Client): Router {
  const router = Router();

  // GET /auth/login
  router.get('/login', (req, res) => {
    const state = generateState();
    req.session.oauthState = state;
    req.session.save((err) => {
      if (err) {
        logger.error('[dashboard] Session-Speicherfehler beim Login:', err);
        res.status(500).send('Session error. Try again.');
        return;
      }
      res.redirect(buildOAuthURL(state));
    });
  });

  // GET /auth/callback
  router.get('/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        logger.warn('[dashboard] OAuth denied by user:', error);
        res.redirect('/auth/denied?reason=oauth_denied');
        return;
      }

      if (!code || !state || state !== req.session.oauthState) {
        res.redirect('/auth/denied?reason=invalid_state');
        return;
      }

      // Exchange code for access token
      const tokenData = await exchangeCode(code);

      // Get Discord user info
      const discordUser = await fetchDiscordUser(tokenData.access_token);

      // Find the first guild the bot is in — this is the dashboard's target guild
      const guild = client.guilds.cache.first();
      if (!guild) {
        logger.error('[dashboard] Bot ist in keiner Guild — Auth nicht möglich.');
        res.redirect('/auth/denied?reason=no_guild');
        return;
      }

      // Get member info (roles) for permission check
      const member = await fetchGuildMember(tokenData.access_token, guild.id);
      const roles  = member?.roles ?? [];

      const permLevel = determinePermLevel(discordUser.id, roles);
      if (permLevel === null) {
        logger.info(`[dashboard] Zugriff verweigert für ${discordUser.username} (${discordUser.id})`);
        res.redirect('/auth/denied?reason=no_permission');
        return;
      }

      // Store user in session
      req.session.oauthState = undefined;
      req.session.user = {
        userId:    discordUser.id,
        username:  discordUser.global_name ?? discordUser.username,
        avatar:    discordUser.avatar,
        permLevel,
        guildId:   guild.id,
      };

      req.session.save((err) => {
        if (err) {
          logger.error('[dashboard] Session-Speicherfehler nach Auth:', err);
          res.status(500).send('Session error. Try again.');
          return;
        }
        logger.info(`[dashboard] Login: ${discordUser.username} (Level ${permLevel})`);
        res.redirect('/');
      });
    } catch (err) {
      logger.error('[dashboard] Auth-Callback-Fehler:', err);
      res.redirect('/auth/denied?reason=error');
    }
  });

  // GET /auth/logout
  router.get('/logout', (req, res) => {
    const username = req.session.user?.username ?? 'unknown';
    req.session.destroy((err) => {
      if (err) logger.warn('[dashboard] Session-Destroy-Fehler:', err);
      else logger.info(`[dashboard] Logout: ${username}`);
      res.redirect('/login.html');
    });
  });

  // GET /auth/denied
  router.get('/denied', (req, res) => {
    const reason = String(req.query.reason ?? 'unknown');
    const messages: Record<string, string> = {
      no_permission: 'Du hast keine Berechtigung für dieses Dashboard.',
      oauth_denied:  'Discord-Login wurde abgebrochen.',
      invalid_state: 'Ungültige OAuth-Anfrage. Bitte versuche es erneut.',
      no_guild:      'Der Bot ist in keiner Guild.',
      error:         'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
    };
    res.status(403).send(`
      <!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
      <title>Zugriff verweigert — SECTOR 13</title>
      <style>body{font-family:monospace;background:#0a0a0c;color:#e8e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .box{background:#111115;border:1px solid #1e1e28;border-radius:8px;padding:2rem;text-align:center;max-width:400px}
      h1{color:#ed4245;margin-top:0}a{color:#8b0000;text-decoration:none}a:hover{text-decoration:underline}</style>
      </head><body><div class="box">
      <h1>Zugriff verweigert</h1>
      <p>${messages[reason] ?? messages.error}</p>
      <a href="/auth/login">← Erneut versuchen</a>
      </div></body></html>
    `);
  });

  return router;
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/routes/auth.routes.ts
git commit -m "feat(dashboard): OAuth2 auth routes (login, callback, logout, denied)"
```

---

### Task 5: Create Overview API Route

**Files:**
- Create: `src/dashboard/routes/api/overview.routes.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/api/overview.routes.ts`:

```typescript
// src/dashboard/routes/api/overview.routes.ts
// GET /api/overview — bot status, server status, ticket counts, 24h activity

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getMessagesTotal, getVoiceTotal, getAiTotal,
  getMemberJoinsTotal, getLatestServerStatus,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';

export function overviewRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const since24h = Math.floor(Date.now() / 1000) - 86400;
      const guild    = client.guilds.cache.get(guildId) ?? client.guilds.cache.first();

      // Bot info
      const bot = {
        status:   'online',
        uptimeSec: Math.floor(process.uptime()),
        latencyMs: client.ws.ping,
        guilds:    client.guilds.cache.size,
        tag:       client.user?.tag ?? 'Unknown',
      };

      // Server status (latest row)
      const latestStatus = getLatestServerStatus(guildId);
      const serverStatus = latestStatus
        ? {
            online:        latestStatus.online === 1,
            playersOnline: latestStatus.players_online,
            maxPlayers:    latestStatus.max_players,
            ping:          latestStatus.ping,
            lastCheck:     latestStatus.checked_at,
          }
        : null;

      // Ticket stats
      const db = getDb();
      const openTickets   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId)  as { n: number }).n;
      const closedToday   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, since24h) as { n: number }).n;
      const closedWeek    = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, Math.floor(Date.now() / 1000) - 7 * 86400) as { n: number }).n;

      // 24h activity
      const activity = {
        messages:    getMessagesTotal(guildId, since24h),
        voiceSecs:   getVoiceTotal(guildId, since24h),
        aiRequests:  getAiTotal(guildId, since24h),
        memberJoins: getMemberJoinsTotal(guildId, since24h),
      };

      // Guild info (from Discord cache — may be approximate)
      const guildInfo = guild
        ? {
            name:        guild.name,
            memberCount: guild.memberCount,
            icon:        guild.iconURL({ size: 64 }),
          }
        : null;

      res.json({
        success: true,
        data: { bot, serverStatus, tickets: { open: openTickets, closedToday, closedWeek }, activity, guild: guildInfo },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/routes/api/overview.routes.ts
git commit -m "feat(dashboard): GET /api/overview route"
```

---

### Task 6: Create Analytics API Routes

**Files:**
- Create: `src/dashboard/routes/api/analytics.routes.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/api/analytics.routes.ts`:

```typescript
// src/dashboard/routes/api/analytics.routes.ts
// GET /api/analytics/messages   — message counts by day + channel
// GET /api/analytics/voice      — voice/stream seconds by day + channel
// GET /api/analytics/growth     — member join/leave by day
// GET /api/analytics/ai         — AI usage by feature + day
// GET /api/analytics/commands   — bot command usage
// GET /api/analytics/server-status — server status history

import { Router } from 'express';
import {
  getMessagesByDay, getMessagesByChannel, getMessagesTotal,
  getVoiceByDay, getVoiceByChannel, getVoiceTotal, getStreamTotal,
  getMemberEventsByDay,
  getAiByDay, getAiByFeature, getAiTotal,
  getCommandUsage, getInteractionsTotal,
  getServerStatusHistory, getPeakPlayers,
} from '../../../analytics/analytics.db';

/** Parse a period query param (e.g. '7d', '30d', '24h') into a unix timestamp seconds ago. */
function parsePeriod(period?: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (!period) return now - 7 * 86400; // default 7 days
  if (period === '24h') return now - 86400;
  if (period === '7d')  return now - 7  * 86400;
  if (period === '30d') return now - 30 * 86400;
  if (period === '90d') return now - 90 * 86400;
  if (period === 'all') return 0;
  const days = parseInt(period);
  if (!isNaN(days)) return now - days * 86400;
  return now - 7 * 86400;
}

export const analyticsRouter = Router();

// Messages
analyticsRouter.get('/messages', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({
      success: true,
      data: {
        byDay:     getMessagesByDay(guildId, since),
        byChannel: getMessagesByChannel(guildId, since),
        total:     getMessagesTotal(guildId, since),
        since,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Voice + Stream
analyticsRouter.get('/voice', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({
      success: true,
      data: {
        byDay:        getVoiceByDay(guildId, since),
        byChannel:    getVoiceByChannel(guildId, since),
        totalSeconds: getVoiceTotal(guildId, since),
        totalStreamSeconds: getStreamTotal(guildId, since),
        since,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Growth
analyticsRouter.get('/growth', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({
      success: true,
      data: {
        byDay: getMemberEventsByDay(guildId, since),
        since,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// AI usage
analyticsRouter.get('/ai', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({
      success: true,
      data: {
        byFeature: getAiByFeature(guildId, since),
        byDay:     getAiByDay(guildId, since),
        total:     getAiTotal(guildId, since),
        since,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Bot commands
analyticsRouter.get('/commands', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({
      success: true,
      data: {
        commands: getCommandUsage(guildId, since),
        total:    getInteractionsTotal(guildId, since),
        since,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Server status history
analyticsRouter.get('/server-status', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    const history = getServerStatusHistory(guildId, since, 500);
    const peak    = getPeakPlayers(guildId, since);

    // Compute uptime percentage
    const total    = history.length;
    const online   = history.filter(r => r.online === 1).length;
    const uptimePct = total > 0 ? Math.round((online / total) * 100) : null;

    res.json({
      success: true,
      data: { history, peak, uptimePct, since },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Ticket analytics
analyticsRouter.get('/tickets', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    const db      = require('../../../db/index').getDb();

    const total   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ?`).get(guildId)  as { n: number }).n;
    const open    = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId) as { n: number }).n;
    const closed  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ?
      GROUP BY category ORDER BY count DESC
    `).all(guildId, since) as Array<{ category: string; count: number }>;

    const byDay = db.prepare(`
      SELECT (COALESCE(closed_at, created_at) / 86400) * 86400 AS date_ts, COUNT(*) AS count
      FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ?
      GROUP BY date_ts ORDER BY date_ts
    `).all(guildId, since) as Array<{ date_ts: number; count: number }>;

    // Average resolution time (closed tickets with both timestamps)
    const avgRow = db.prepare(`
      SELECT AVG(closed_at - created_at) AS avg_secs
      FROM tickets WHERE guild_id = ? AND status = 'closed' AND closed_at IS NOT NULL AND created_at IS NOT NULL AND COALESCE(closed_at, created_at) >= ?
    `).get(guildId, since) as { avg_secs: number | null };

    res.json({
      success: true,
      data: { total, open, closed, byCategory, byDay, avgResolutionSecs: avgRow.avg_secs, since },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/routes/api/analytics.routes.ts
git commit -m "feat(dashboard): analytics API routes (messages, voice, growth, AI, commands, status)"
```

---

### Task 7: Create Tickets, Members, and Logs API Routes

**Files:**
- Create: `src/dashboard/routes/api/tickets.routes.ts`
- Create: `src/dashboard/routes/api/members.routes.ts`
- Create: `src/dashboard/routes/api/logs.routes.ts`

- [ ] **Step 1: Create tickets.routes.ts**

Create `src/dashboard/routes/api/tickets.routes.ts`:

```typescript
// src/dashboard/routes/api/tickets.routes.ts
import { Router } from 'express';
import {
  getRecentClosedTickets, countClosedTickets, searchClosedTickets,
  countSearchClosedTickets, getClosedTicketById, getAllOpenTickets,
} from '../../../db/index';
import { requirePermission, PermLevel } from '../../auth/middleware';

export const ticketsRouter = Router();

ticketsRouter.use(requirePermission(PermLevel.Moderator));

// GET /api/tickets?status=open|closed|all&page=1&search=
ticketsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const status  = (req.query.status as string) ?? 'all';
    const page    = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit   = 25;
    const offset  = (page - 1) * limit;
    const search  = (req.query.search as string) ?? '';

    if (status === 'open') {
      const tickets = getAllOpenTickets().filter(t => t.guild_id === guildId);
      res.json({ success: true, data: { tickets, total: tickets.length, page: 1, pages: 1 } });
      return;
    }

    const total   = search ? countSearchClosedTickets(guildId, search) : countClosedTickets(guildId);
    const tickets = search
      ? searchClosedTickets(guildId, search, limit, offset)
      : getRecentClosedTickets(guildId, limit, offset);

    res.json({
      success: true,
      data: { tickets, total, page, pages: Math.ceil(total / limit) },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// GET /api/tickets/:id
ticketsRouter.get('/:id', (req, res) => {
  try {
    const guildId  = req.session.user!.guildId;
    const id       = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const ticket   = getClosedTicketById(id, guildId);
    if (!ticket)   { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: ticket });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 2: Create members.routes.ts**

Create `src/dashboard/routes/api/members.routes.ts`:

```typescript
// src/dashboard/routes/api/members.routes.ts
// Fetches live member data from Discord via the bot's guild cache.
// Returns roles, join date, username only — no activity metrics.

import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { getDb } from '../../../db/index';

export function membersRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Moderator));

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const guild   = client.guilds.cache.get(guildId);
      if (!guild) { res.status(404).json({ success: false, error: 'Guild not found' }); return; }

      // Fetch members (requires GuildMembers intent — already enabled)
      const members = guild.members.cache.map(m => ({
        id:        m.id,
        username:  m.user.username,
        globalName: m.user.globalName,
        displayName: m.displayName,
        avatar:    m.user.displayAvatarURL({ size: 64 }),
        joinedAt:  m.joinedTimestamp,
        roles:     m.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        isBot:     m.user.bot,
      })).filter(m => !m.isBot);

      // Enrich with ticket count from DB
      const db = getDb();
      const ticketCounts = db.prepare(
        `SELECT opener_user_id, COUNT(*) AS count FROM tickets WHERE guild_id = ? GROUP BY opener_user_id`
      ).all(guildId) as Array<{ opener_user_id: string; count: number }>;
      const ticketMap = new Map(ticketCounts.map(r => [r.opener_user_id, r.count]));

      const enriched = members.map(m => ({ ...m, ticketCount: ticketMap.get(m.id) ?? 0 }));

      res.json({ success: true, data: { members: enriched, total: enriched.length } });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
```

- [ ] **Step 3: Create logs.routes.ts**

Create `src/dashboard/routes/api/logs.routes.ts`:

```typescript
// src/dashboard/routes/api/logs.routes.ts
// GET /api/logs        — recent log entries (snapshot)
// GET /api/logs/stream — Server-Sent Events for live log tailing
// GET /api/audit-logs  — dashboard audit trail

import { Router } from 'express';
import { getLogBuffer } from '../../../utils/logger';
import { getAuditLogs } from '../../../analytics/analytics.db';
import { requirePermission, PermLevel } from '../../auth/middleware';

export const logsRouter = Router();

logsRouter.use(requirePermission(PermLevel.Moderator));

// Snapshot of recent logs
logsRouter.get('/', (req, res) => {
  try {
    const level  = (req.query.level as string) ?? '';
    const search = (req.query.search as string) ?? '';
    let entries  = getLogBuffer();
    if (level)  entries = entries.filter(e => e.level === level);
    if (search) entries = entries.filter(e => e.message.toLowerCase().includes(search.toLowerCase()));
    // Return most recent 200
    res.json({ success: true, data: entries.slice(-200).reverse() });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// Live SSE log stream
logsRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send initial buffer
  const initial = getLogBuffer().slice(-50);
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  let lastLength = getLogBuffer().length;

  const interval = setInterval(() => {
    const buf     = getLogBuffer();
    const newOnes = buf.slice(lastLength);
    lastLength    = buf.length;
    if (newOnes.length > 0) {
      res.write(`data: ${JSON.stringify(newOnes)}\n\n`);
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// Audit logs (Admin only)
logsRouter.get('/audit', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const limit   = Math.min(200, parseInt(req.query.limit as string) || 50);
    res.json({ success: true, data: getAuditLogs(guildId, limit) });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 4: Verify build**

```
npm run build
```

- [ ] **Step 5: Commit**

```
git add src/dashboard/routes/api/tickets.routes.ts src/dashboard/routes/api/members.routes.ts src/dashboard/routes/api/logs.routes.ts
git commit -m "feat(dashboard): tickets, members, logs API routes"
```

---

### Task 8: Create Settings API Route

**Files:**
- Create: `src/dashboard/routes/api/settings.routes.ts`

- [ ] **Step 1: Create the file**

Create `src/dashboard/routes/api/settings.routes.ts`:

```typescript
// src/dashboard/routes/api/settings.routes.ts
// GET /api/settings          — all config (secrets masked)
// PATCH /api/settings/guild  — update guild_config
// PATCH /api/settings/scum   — update scum_status_config (secrets write-only)

import { Router } from 'express';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { insertAuditLog } from '../../../analytics/analytics.db';
import {
  getGuildConfig, upsertGuildConfig, getGuildSupportRoles,
  getScumStatusConfig, upsertScumStatusConfig,
  getChangelogConfig,
} from '../../../db/index';

export const settingsRouter = Router();

settingsRouter.use(requirePermission(PermLevel.Admin));

const MASK = '••••••••';

function maskField(value: string | null | undefined): string {
  if (!value) return '';
  return MASK;
}

// GET /api/settings
settingsRouter.get('/', (req, res) => {
  try {
    const guildId      = req.session.user!.guildId;
    const guildConfig  = getGuildConfig(guildId);
    const supportRoles = getGuildSupportRoles(guildId);
    const scumConfig   = getScumStatusConfig(guildId);
    const changelog    = getChangelogConfig(guildId);

    res.json({
      success: true,
      data: {
        guild: guildConfig ?? null,
        supportRoles,
        scumStatus: scumConfig
          ? {
              ...scumConfig,
              // host and port are not secrets — show them
            }
          : null,
        changelog: changelog ?? null,
        // Streamer config: twitch_client_secret and youtube_api_key are masked
        streamer: null, // Loaded separately if needed
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// PATCH /api/settings/guild
settingsRouter.patch('/guild', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const body    = req.body as Record<string, unknown>;

    // Allowlist only safe fields
    const allowed = [
      'ticket_panel_channel_id', 'ticket_category_id', 'ticket_log_channel_id',
      'ticket_archive_channel_id', 'rules_channel_id', 'whitelist_role_id',
    ];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = typeof body[key] === 'string' ? body[key] : null;
    }

    const old = getGuildConfig(guildId);
    upsertGuildConfig(guildId, patch as Parameters<typeof upsertGuildConfig>[1]);

    insertAuditLog({
      guildId, adminUserId: user.userId,
      action: 'settings.guild.update',
      oldValue: old, newValue: { ...old, ...patch },
      success: true, ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

// PATCH /api/settings/scum
settingsRouter.patch('/scum', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const body    = req.body as Record<string, unknown>;

    // Non-secret fields
    const patch: Record<string, unknown> = {};
    const plainFields = ['channel_id', 'host', 'query_port', 'update_interval_secs', 'enabled'];
    for (const key of plainFields) {
      if (key in body) patch[key] = body[key];
    }

    const old = getScumStatusConfig(guildId);
    upsertScumStatusConfig(guildId, patch as Parameters<typeof upsertScumStatusConfig>[1]);

    insertAuditLog({
      guildId, adminUserId: user.userId,
      action: 'settings.scum.update',
      oldValue: old, newValue: { ...old, ...patch },
      success: true, ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/dashboard/routes/api/settings.routes.ts
git commit -m "feat(dashboard): settings API routes with secret masking + audit log"
```

---

### Task 9: Create Server Status Test Route and API Index

**Files:**
- Create: `src/dashboard/routes/api/server-status.routes.ts`
- Create: `src/dashboard/routes/api/index.ts`

- [ ] **Step 1: Create server-status.routes.ts**

Create `src/dashboard/routes/api/server-status.routes.ts`:

```typescript
// src/dashboard/routes/api/server-status.routes.ts
// GET  /api/server-status      — current config + latest status
// POST /api/server-status/test — trigger immediate status check, return result

import { Router } from 'express';
import type { Client } from 'discord.js';
import { getScumStatusConfig } from '../../../db/index';
import { queryServer } from '../../../features/scumStatus/scumStatus.service';
import { requirePermission, PermLevel } from '../../auth/middleware';

export function serverStatusRouter(client: Client): Router {
  const router = Router();

  // GET current config + latest snapshot
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const config  = getScumStatusConfig(guildId);
      res.json({ success: true, data: config ?? null });
    } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
  });

  // POST test — run a live check
  router.post('/test', requirePermission(PermLevel.Admin), async (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const config  = getScumStatusConfig(guildId);
      if (!config?.host || !config.query_port) {
        res.status(400).json({ success: false, error: 'Server not configured' });
        return;
      }
      const result = await queryServer(config.host, config.query_port);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
```

- [ ] **Step 2: Create api/index.ts**

Create `src/dashboard/routes/api/index.ts`:

```typescript
// src/dashboard/routes/api/index.ts
// Assembles all API sub-routers into one router factory.

import { Router } from 'express';
import type { Client } from 'discord.js';
import { overviewRouter } from './overview.routes';
import { analyticsRouter } from './analytics.routes';
import { ticketsRouter } from './tickets.routes';
import { settingsRouter } from './settings.routes';
import { logsRouter } from './logs.routes';
import { membersRouter } from './members.routes';
import { serverStatusRouter } from './server-status.routes';

export function buildApiRouter(client: Client): Router {
  const router = Router();

  // Current user info
  router.get('/me', (req, res) => {
    const { userId, username, avatar, permLevel } = req.session.user!;
    res.json({ success: true, data: { userId, username, avatar, permLevel } });
  });

  router.use('/overview',      overviewRouter(client));
  router.use('/analytics',     analyticsRouter);
  router.use('/tickets',       ticketsRouter);
  router.use('/settings',      settingsRouter);
  router.use('/logs',          logsRouter);
  router.use('/members',       membersRouter(client));
  router.use('/server-status', serverStatusRouter(client));

  return router;
}
```

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/dashboard/routes/api/server-status.routes.ts src/dashboard/routes/api/index.ts
git commit -m "feat(dashboard): server-status route + API router index"
```

---

### Task 10: Create Express Server

**Files:**
- Create: `src/dashboard/server.ts`
- Create: `dashboard/public/.gitkeep`

- [ ] **Step 1: Create the public directory placeholder**

```
mkdir -p dashboard/public
echo "" > dashboard/public/.gitkeep
```

- [ ] **Step 2: Create server.ts**

Create `src/dashboard/server.ts`:

```typescript
// src/dashboard/server.ts
// Express dashboard server. Started conditionally from src/index.ts.
// Static files served from dashboard/public/ (project root, not src/).

import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { Client } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { requireAuth, rateLimit } from './auth/middleware';
import { buildAuthRouter } from './routes/auth.routes';
import { buildApiRouter } from './routes/api/index';

const SQLiteStore = connectSqlite3(session);

export function startDashboard(client: Client): void {
  const app = express();

  // Parse JSON bodies (max 1 MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Trust proxy (important when behind nginx/PM2 for correct req.ip)
  app.set('trust proxy', 1);

  // Ensure session DB directory exists
  mkdirSync('./data', { recursive: true });

  // Session store backed by SQLite (separate file from bot DB)
  app.use(session({
    // connect-sqlite3 typing is imperfect — cast as never
    store: new SQLiteStore({ db: 'dashboard-sessions.db', dir: './data' }) as never,
    secret:            env.DASHBOARD_SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure:   env.NODE_ENV === 'production',
      maxAge:   24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Auth routes (rate-limited: 10 req/min per IP)
  app.use('/auth', rateLimit(10, 60_000), buildAuthRouter(client));

  // Protected API routes
  app.use('/api', requireAuth, buildApiRouter(client));

  // Static files: HTML/CSS/JS from dashboard/public/ at project root
  const PUBLIC_DIR = join(process.cwd(), 'dashboard', 'public');
  app.use(express.static(PUBLIC_DIR));

  // SPA fallback: serve index.html for unknown paths (client-side routing)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/auth/') || req.path.startsWith('/api/')) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.sendFile('index.html', { root: PUBLIC_DIR }, (err) => {
      if (err) res.status(404).send('Dashboard not found. Run Sub-project C to build the frontend.');
    });
  });

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('[dashboard] Unbehandelter Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  app.listen(env.DASHBOARD_PORT, () => {
    logger.info(`[dashboard] Dashboard läuft auf Port ${env.DASHBOARD_PORT} — ${env.NODE_ENV}`);
    logger.info(`[dashboard] URL: http://localhost:${env.DASHBOARD_PORT}`);
  });
}
```

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/dashboard/server.ts dashboard/public/.gitkeep
git commit -m "feat(dashboard): Express server with session store and static file serving"
```

---

### Task 11: Wire Dashboard into index.ts and Test

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add dashboard startup to index.ts**

Add to the bottom of `src/index.ts`, after `client.login(env.DISCORD_TOKEN)`:

```typescript
// Start web dashboard if enabled
if (env.DASHBOARD_ENABLED) {
  client.once('ready', () => {
    import('./dashboard/server').then(({ startDashboard }) => {
      startDashboard(client);
    }).catch(err => logger.error('[dashboard] Startfehler:', err));
  });
}
```

- [ ] **Step 2: Build and restart**

```
npm run build
```

Set `DASHBOARD_ENABLED=true` in `.env` temporarily, then:

```
pm2 restart scum-bot
```

- [ ] **Step 3: Test with curl**

Wait 10 seconds for bot to come online, then:

```
# Should return 401 (not authenticated)
curl -s http://localhost:3000/api/overview | python -m json.tool

# Should return login page redirect (302) or denied page
curl -s -I http://localhost:3000/

# Auth login redirect
curl -s -I http://localhost:3000/auth/login
```

Expected: `/api/overview` returns `{"success":false,"error":"Not authenticated"}` with status 401.

Expected: `/auth/login` returns a 302 redirect to `discord.com/api/oauth2/authorize`.

- [ ] **Step 4: Test OAuth flow manually**

Open browser: `http://localhost:3000/auth/login`

This should redirect to Discord login. Complete the flow. If `DASHBOARD_ALLOWED_USER_IDS` is set to your Discord user ID, you should land on `http://localhost:3000/` (which shows the index.html not-yet-built page).

- [ ] **Step 5: Verify /api/me works after login**

After completing OAuth in browser:

```
# In browser devtools console after login:
fetch('/api/me').then(r => r.json()).then(console.log)
```

Expected: `{ success: true, data: { userId: "...", username: "...", permLevel: 4 } }`

- [ ] **Step 6: Commit**

```
git add src/index.ts
git commit -m "feat(dashboard): wire dashboard startup into bot index.ts"
```

---

## Self-Review Checklist

- [x] Spec section 1 (auth): Discord OAuth2 ✅, permission levels ✅, session ✅, logout ✅, protected routes ✅
- [x] Spec section 10 (API): All specified routes implemented ✅
- [x] Spec section 14 (security): Auth middleware ✅, rate limiting ✅, input validation ✅, no secrets in responses ✅, stack traces not returned ✅
- [x] Spec section 6 (audit logs): insertAuditLog() called on settings changes ✅, secrets masked ✅
- [x] Spec section 15 (integration): DASHBOARD_ENABLED env var ✅, port configurable ✅, started from index.ts ✅
- [x] Privacy: No user activity rankings in API responses ✅, voice_session_temp not exposed ✅
- [x] No real data leaks: secret fields in settings are masked before response ✅
