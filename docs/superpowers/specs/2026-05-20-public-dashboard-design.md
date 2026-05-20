# Public User Dashboard — Design Spec

**Date:** 2026-05-20  
**Project:** Sector 13 SCUM Discord Bot — Sub-project D  
**Status:** Approved

---

## Goal

Build a public-facing user dashboard accessible to all Discord members at `http://<server-ip>:3000/public`. Users log in with Discord, see aggregated server analytics and their own tickets. No admin data, no logs, no settings, no sensitive information of any kind.

---

## Architecture

### URL Layout (Port 3000)

| Path prefix | Purpose | Auth |
|---|---|---|
| `/` | Admin SPA (existing, unchanged) | Admin session (`req.session.user`) |
| `/api/*` | Admin API (existing, unchanged) | Admin session |
| `/public` | User SPA static files | None (static) |
| `/public-api/*` | User API | Public session (`req.session.publicUser`) |
| `/auth/public/*` | Public OAuth routes | None |

### Session Separation

Two completely independent session namespaces in the same SQLite store:

- `req.session.user` — set by admin OAuth, used by `/api` routes
- `req.session.publicUser` — set by public OAuth, used by `/public-api` routes

A public user who knows admin API URLs cannot access them — admin routes check `req.session.user`, not `req.session.publicUser`. No cross-contamination possible.

### Session TypeScript Declaration

```typescript
// Added to express-session module augmentation in public-middleware.ts
interface SessionData {
  publicUser?: {
    userId:   string;
    username: string;
    avatar:   string | null;
    guildId:  string;
  };
}
```

---

## OAuth Flow (Public)

1. User visits `http://<ip>:3000/public` → served `dashboard/public-user/index.html`
2. `init()` calls `GET /public-api/me` → 401 → redirect to `/public/login.html`
3. User clicks "Mit Discord anmelden" → `GET /auth/public/login`
4. Server redirects to Discord OAuth with scopes `identify guilds.members.read`
5. Discord redirects to `GET /auth/public/callback`
6. **No permission check** — any Discord user in the guild is allowed
7. `req.session.publicUser` is set with `{ userId, username, avatar, guildId }`
8. Redirect to `/public/`

### New ENV Variable

```
PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL=http://<ip>:3000/auth/public/callback
```

Must also be registered in Discord Developer Portal → OAuth2 → Redirects.

---

## Backend: New Files

### `src/dashboard/auth/public-middleware.ts`

```typescript
requirePublicAuth(req, res, next):
  if (!req.session.publicUser):
    if API request: return 401 JSON
    else: redirect to /public/login.html
  else: next()
```

### `src/dashboard/routes/auth.routes.ts` (additions)

Three new routes added to the existing auth router:

- `GET /auth/public/login` — generate state, redirect to Discord OAuth
- `GET /auth/public/callback` — exchange code, fetch user, set `req.session.publicUser`, redirect to `/public/`
- `GET /auth/public/logout` — destroy session, redirect to `/public/login.html`

**OAuth scopes for public flow:** `identify` only (just user ID, username, avatar). No `guilds.members.read` needed.

**Guild membership verification:** After obtaining the user via `fetchDiscordUser(accessToken)`, the bot checks its own guild cache: `guild.members.fetch(discordUser.id)`. If the member is found → allow. If not → redirect to `/auth/denied?reason=not_in_guild`. This uses the bot token, not the user's OAuth token, so no extra scope is required.

### `src/dashboard/routes/public-api/index.ts`

```typescript
export function buildPublicApiRouter(client: Client): Router {
  const router = Router();
  router.use(requirePublicAuth);
  router.get('/me', ...);
  router.use('/overview', publicOverviewRouter(client));
  router.use('/analytics', publicAnalyticsRouter);
  router.use('/tickets', publicTicketsRouter);
  return router;
}
```

### `src/dashboard/routes/public-api/overview.ts`

`GET /public-api/overview` returns:

```json
{
  "success": true,
  "data": {
    "scumServer": {
      "online": true,
      "playersOnline": 12,
      "maxPlayers": 64,
      "ping": 45,
      "lastCheck": 1234567890
    },
    "guild": {
      "name": "SECTOR 13",
      "memberCount": 342
    },
    "activity": {
      "messages": 1204,
      "voiceSecs": 7200
    }
  }
}
```

Uses: `getLatestServerStatus(guildId)`, `getMessagesTotal(guildId, since24h)`, `getVoiceTotal(guildId, since24h)`, `client.guilds.cache.get(guildId)`.

No bot internals (no latency, no uptime, no guild count).

### `src/dashboard/routes/public-api/analytics.ts`

Delegates to existing analytics DB functions. Identical data to admin analytics routes, minus any per-user fields. Six endpoints:

- `GET /public-api/analytics/messages?period=`
- `GET /public-api/analytics/voice?period=`
- `GET /public-api/analytics/growth?period=`
- `GET /public-api/analytics/tickets?period=`
- `GET /public-api/analytics/server-status?period=`
- `GET /public-api/analytics/ai?period=`

Response shapes are identical to admin analytics routes. No new DB queries needed — reuse existing functions from `analytics.db.ts`.

### `src/dashboard/routes/public-api/tickets.ts`

`GET /public-api/tickets/mine?status=&page=&search=`  
Filter: `WHERE opener_user_id = req.session.publicUser.userId AND guild_id = guildId`

`GET /public-api/tickets/mine/:id`  
Returns single ticket only if `opener_user_id = req.session.publicUser.userId`. Returns 404 if not found or belongs to another user. No summary truncation — full summary shown to the ticket owner.

**Security:** Both endpoints enforce ownership at the DB query level, not application level. A user cannot retrieve another user's ticket by guessing an ID.

---

## Backend: Modified Files

### `src/dashboard/server.ts`

Add after existing routes (order matters — API before static):

```typescript
// Public user API (must be registered before /public static, so /public-api/* is not caught by static middleware)
app.use('/public-api', buildPublicApiRouter(client));

// Public user static files
const PUBLIC_USER_DIR = join(process.cwd(), 'dashboard', 'public-user');
app.use('/public', express.static(PUBLIC_USER_DIR));

// SPA fallback for /public/* (unknown paths serve index.html for client-side routing)
app.get('/public/*', (_req, res) => {
  res.sendFile('index.html', { root: PUBLIC_USER_DIR }, (err) => {
    if (err) res.status(404).send('Public dashboard not found.');
  });
});
```

Note: Express path-prefix matching uses segment boundaries, so `/public` does not match `/public-api`. Registering in this order is belt-and-suspenders for correctness.

---

## Frontend: `dashboard/public-user/`

### `login.html`

Same design as admin login — dark theme, Discord button linking to `/auth/public/login`. Different subtitle: "Community Dashboard — für alle SECTOR 13 Mitglieder".

### `index.html`

SPA shell with:
- Sidebar: 3 nav items — Overview (`⬡`), Analytics (`📈`), Meine Tickets (`🎫`)
- Topbar: page title, user avatar + name, logout link (`/auth/public/logout`)
- `#page-content` div
- Scripts: `/public/js/api.js`, `/public/js/charts.js`, `/public/js/app.js`
- Chart.js CDN (same as admin)

### `js/api.js`

Identical structure to admin `api.js` but calls `/public-api/*`:

```javascript
const API = {
  me:             () => API.get('/me'),
  overview:       () => API.get('/overview'),
  messages:       (p) => API.get(`/analytics/messages?period=${p}`),
  voice:          (p) => API.get(`/analytics/voice?period=${p}`),
  growth:         (p) => API.get(`/analytics/growth?period=${p}`),
  tickets:        (p) => API.get(`/analytics/tickets?period=${p}`),
  statusHistory:  (p) => API.get(`/analytics/server-status?period=${p}`),
  ai:             (p) => API.get(`/analytics/ai?period=${p}`),
  myTickets:      (q) => API.get(`/tickets/mine?${new URLSearchParams(q)}`),
  myTicket:       (id) => API.get(`/tickets/mine/${id}`),
};
window.API = API;
```

Base URL for all requests: `/public-api`. Redirects to `/public/login.html` on 401.

### `js/charts.js`

Identical to admin `charts.js` — copy verbatim.

### `js/app.js`

Same router pattern as admin `app.js`:
- PAGE_TITLES: `{ overview, analytics, tickets }`
- `loadScript`, `navigateTo`, `periodBar`, `toast`, `fmt`, `fmtDate`, `escapeHtml`
- `init()` calls `/public-api/me`, sets user name/avatar in topbar
- `hashchange` listener

### `js/pages/overview.js`

`window['page-overview']` with `render(container)`:
- Calls `API.overview()`
- Shows SCUM server card (online badge, players/max, ping, last check)
- Shows Discord server card (name, member count)
- Shows activity cards (messages today, voice time today)
- All values use `escapeHtml()` when inserted into innerHTML

### `js/pages/analytics.js`

`window['page-analytics']` with tab-based navigation:
- **6 tabs:** Nachrichten | Voice | Wachstum | Tickets | Server | AI
- One `load(tab, period)` function per tab
- Period selector bar per tab (remembers state)
- Charts reuse admin analytics chart patterns exactly
- Empty states for no data
- All API calls to `/public-api/analytics/*`

### `js/pages/tickets.js`

`window['page-tickets']` with `render()`, `load()`, `showDetail(id)`:
- Status filter (offen / geschlossen / alle), search with debounce
- Table: Kategorie, Status, Erstellt, Geschlossen, Zusammenfassung (truncated)
- Click row → modal with full ticket details (full summary shown — it's their own ticket)
- Calls `API.myTickets(...)` and `API.myTicket(id)`
- All user-controlled strings escaped with `escapeHtml()`

---

## Security Constraints

1. **No secrets displayed** — no API keys, tokens, or internal configuration
2. **No other users' data** — tickets filtered strictly by `opener_user_id` at DB level
3. **No admin API access** — `req.session.publicUser` cannot authenticate against `/api/*`
4. **No logs or audit trail** — not exposed in public API
5. **No member list** — no `/public-api/members` endpoint
6. **Guild membership required** — `fetchGuildMember` confirms user is in the guild before session is created
7. **XSS prevention** — `escapeHtml()` used for all user-controlled strings in innerHTML

---

## What Is NOT in This Dashboard

- Bot logs / audit trail
- Settings / configuration
- Member list / member details
- AI prompt content (never stored)
- Other users' tickets
- Bot internals (latency, uptime, guild count)
- Analytics-AI per-user breakdown (only aggregated server totals)

---

## File Map Summary

| File | Action |
|---|---|
| `src/dashboard/auth/public-middleware.ts` | Create |
| `src/dashboard/routes/auth.routes.ts` | Modify (add 3 public routes) |
| `src/dashboard/routes/public-api/index.ts` | Create |
| `src/dashboard/routes/public-api/overview.ts` | Create |
| `src/dashboard/routes/public-api/analytics.ts` | Create |
| `src/dashboard/routes/public-api/tickets.ts` | Create |
| `src/dashboard/server.ts` | Modify (add public routes + static) |
| `src/config/env.ts` | Modify (add `PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL`) |
| `.env` | Modify (add new env var) |
| `dashboard/public-user/login.html` | Create |
| `dashboard/public-user/index.html` | Create |
| `dashboard/public-user/css/dashboard.css` | Copy from admin |
| `dashboard/public-user/js/api.js` | Create |
| `dashboard/public-user/js/charts.js` | Copy from admin |
| `dashboard/public-user/js/app.js` | Create |
| `dashboard/public-user/js/pages/overview.js` | Create |
| `dashboard/public-user/js/pages/analytics.js` | Create |
| `dashboard/public-user/js/pages/tickets.js` | Create |
