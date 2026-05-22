# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the sectorbot admin dashboard against CSRF, session fixation, missing security headers, weak OAuth nonce, missing rate limits, and unvalidated inputs — without changing any bot logic or UI.

**Architecture:** Layered middleware additions to `src/dashboard/server.ts` + new `src/dashboard/auth/csrf.ts` module + shared zod schemas for the two settings mutation routes that accept raw channel/role IDs. All other routes already have solid manual validation and complete audit logging.

**Tech Stack:** Express 4, express-session, helmet, csrf-csrf, zod, better-sqlite3, vitest, supertest

**Working directory for all tasks:** `C:\Users\Administrator\Desktop\sectorbot` (main repo, not the worktree — the worktree is an older public-dashboard branch and does not contain the admin routes).

---

## Correction from design spec

After reading all admin route files, the design spec's Section 5 was incorrect:
- **All admin routes already call `insertAuditLog`** (rules, settings, bot-settings, events, changelog, announcements, faq, wipe, server-info, system)
- **`GET /api/logs/audit` already exists** in `logs.routes.ts` at line 43

Section 5 work reduces to: verify the audit endpoint response strips raw `old_value`/`new_value` JSON strings (a one-line change, covered in Task 7).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `package.json` | Modify | Add helmet, csrf-csrf, zod (prod); supertest, @types/supertest (dev) |
| `src/dashboard/server.ts` | Modify | helmet(), doubleCsrfProtection on /api, rateLimit on /api, DISCORD_CLIENT_SECRET prod check |
| `src/dashboard/auth/csrf.ts` | **Create** | doubleCsrf config, export generateToken + doubleCsrfProtection |
| `src/dashboard/auth/discord-oauth.ts` | Modify | generateState() uses crypto.randomBytes(32) |
| `src/dashboard/routes/auth.routes.ts` | Modify | session.regenerate() in both /callback handlers |
| `src/dashboard/routes/api/index.ts` | Modify | Add GET /csrf-token endpoint |
| `src/dashboard/routes/shared/schemas.ts` | **Create** | Reusable zod building blocks |
| `src/dashboard/routes/api/settings.routes.ts` | Modify | Zod on PATCH /guild and PATCH /scum |
| `src/dashboard/routes/api/logs.routes.ts` | Modify | Strip old_value/new_value from audit endpoint response |
| `src/dashboard/__tests__/security.test.ts` | **Create** | 8 security tests via supertest |
| `docs/SECURITY.md` | **Create** | Security documentation |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
cd C:\Users\Administrator\Desktop\sectorbot
npm install helmet csrf-csrf zod
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev supertest @types/supertest
```

Expected output: `added N packages` with no errors.

- [ ] **Step 3: Verify package.json now lists all four packages**

Check that `package.json` contains:
```json
"dependencies": {
  "helmet": "...",
  "csrf-csrf": "...",
  "zod": "...",
  ...
},
"devDependencies": {
  "supertest": "...",
  "@types/supertest": "...",
  ...
}
```

- [ ] **Step 4: Run existing tests to confirm no breakage**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(security): add helmet, csrf-csrf, zod, supertest"
```

---

## Task 2: Security Headers (Helmet)

**Files:**
- Modify: `src/dashboard/server.ts`

The current `server.ts` has no security headers. Helmet adds X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, and a CSP in one call. It must be the first `app.use()` call so it applies to all responses including error responses.

The CSP uses `'unsafe-inline'` for scripts/styles because the existing SPA uses inline scripts. `cdn.discordapp.com` is allowed for img-src because Discord avatars are loaded by the frontend.

- [ ] **Step 1: Add helmet import to `src/dashboard/server.ts`**

Open `src/dashboard/server.ts`. After the existing imports (line 8, after `import { mkdirSync } from 'fs';`), add:

```ts
import helmet from 'helmet';
```

- [ ] **Step 2: Add helmet as the first middleware**

In `src/dashboard/server.ts`, after `app.set('trust proxy', 1);` (line 29) and before the `DATA_DIR` block, add:

```ts
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'https://cdn.discordapp.com'],
        connectSrc:  ["'self'"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
      },
    },
  }));
```

- [ ] **Step 3: Verify the server still starts (TypeScript compiles)**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/server.ts
git commit -m "feat(security): add Helmet security headers to dashboard"
```

---

## Task 3: Create CSRF Module

**Files:**
- Create: `src/dashboard/auth/csrf.ts`

This file configures `csrf-csrf`'s double-submit cookie pattern. `getSecret` uses the session secret so the CSRF cookie is tied to the same secret as the session. `getTokenFromRequest` tells the library where to find the token in the request — we use the `x-csrf-token` header (lowercased by Express/Node).

- [ ] **Step 1: Create `src/dashboard/auth/csrf.ts`**

```ts
// src/dashboard/auth/csrf.ts
// CSRF protection via csrf-csrf (double-submit cookie pattern).
// Import doubleCsrfProtection and generateToken from here — do not configure doubleCsrf elsewhere.

import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config/env';

export const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.DASHBOARD_SESSION_SECRET,
  cookieName: '__csrf',
  cookieOptions: {
    sameSite: 'strict' as const,
    secure:   env.NODE_ENV === 'production',
    httpOnly: true,
  },
  size: 64,
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  errorConfig: {
    statusCode: 403,
    message: 'CSRF token mismatch',
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/auth/csrf.ts
git commit -m "feat(security): add csrf-csrf module"
```

---

## Task 4: Wire CSRF Into Server + Add Token Endpoint

**Files:**
- Modify: `src/dashboard/server.ts`
- Modify: `src/dashboard/routes/api/index.ts`

The CSRF middleware must be applied **after** `requireAuth` and **after** `express-session`, so that the session is available when the token is generated or validated. It applies only to `/api/*` (not `/auth/*` or `/public-api/*`).

The `GET /api/csrf-token` endpoint generates a new token, sets the signed `__csrf` cookie, and returns the plain token to the SPA so the frontend can include it as an `X-CSRF-Token` header on mutations. This endpoint is a GET so CSRF protection is not applied to it (only POST/PATCH/PUT/DELETE are validated).

- [ ] **Step 1: Add CSRF import to `src/dashboard/server.ts`**

After the existing imports in `src/dashboard/server.ts`, add:

```ts
import { doubleCsrfProtection } from './auth/csrf';
```

- [ ] **Step 2: Apply CSRF middleware to `/api` in `src/dashboard/server.ts`**

Find the line:
```ts
  // Protected API routes
  app.use('/api', requireAuth, buildApiRouter(client));
```

Replace it with:
```ts
  // Protected API routes — requireAuth then CSRF on mutations
  app.use('/api', requireAuth, doubleCsrfProtection, buildApiRouter(client));
```

- [ ] **Step 3: Add `GET /csrf-token` to `src/dashboard/routes/api/index.ts`**

Open `src/dashboard/routes/api/index.ts`. Add the import at the top:
```ts
import { generateToken } from '../../auth/csrf';
```

Then, inside `buildApiRouter`, after `router.get('/me', ...)` (around line 25), add:
```ts
  // GET /api/csrf-token — SPA fetches this on load to get a CSRF token for mutations
  router.get('/csrf-token', (req, res) => {
    const token = generateToken(req, res);
    res.json({ success: true, data: { csrfToken: token } });
  });
```

- [ ] **Step 4: Build to check types**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/server.ts src/dashboard/routes/api/index.ts
git commit -m "feat(security): wire CSRF protection onto /api routes"
```

---

## Task 5: OAuth Hardening + Session Fixation Fix + Prod Secret Check

**Files:**
- Modify: `src/dashboard/auth/discord-oauth.ts`
- Modify: `src/dashboard/routes/auth.routes.ts`
- Modify: `src/dashboard/server.ts`

Three independent fixes bundled because they're all in auth/session code:

1. **`Math.random()` state** — `Math.random()` is not cryptographically random; `crypto.randomBytes(32)` gives 256 bits of entropy.
2. **Session fixation** — without `session.regenerate()`, an attacker who obtains the pre-login session ID can hijack the newly authenticated session. Calling `regenerate()` creates a new session ID on login.
3. **`DISCORD_CLIENT_SECRET` check** — the existing pattern for `DASHBOARD_SESSION_SECRET` is reused.

- [ ] **Step 1: Fix `generateState()` in `src/dashboard/auth/discord-oauth.ts`**

Open `src/dashboard/auth/discord-oauth.ts`. Find lines 79-82:
```ts
/** Generate a random state nonce for CSRF protection. */
export function generateState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
```

Replace with:
```ts
import { randomBytes } from 'crypto';

/** Generate a cryptographically secure state nonce for OAuth CSRF protection. */
export function generateState(): string {
  return randomBytes(32).toString('hex');
}
```

Note: the `import { randomBytes } from 'crypto';` line goes at the top of the file with the other imports (Node.js built-in, no install needed).

- [ ] **Step 2: Add `session.regenerate()` in admin callback in `src/dashboard/routes/auth.routes.ts`**

Open `src/dashboard/routes/auth.routes.ts`. Find the admin callback's success block (around lines 89-108):
```ts
      // Store user in session
      req.session.oauthState = undefined;
      req.session.user = {
        userId:    discordUser.id,
        username:  discordUser.global_name ?? discordUser.username,
        avatar:    discordUser.avatar,
        permLevel: effectivePerm,
        isContentEditor,
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
```

Replace that entire block with:
```ts
      // Regenerate session ID to prevent session fixation, then store user
      const newUser = {
        userId:    discordUser.id,
        username:  discordUser.global_name ?? discordUser.username,
        avatar:    discordUser.avatar,
        permLevel: effectivePerm,
        isContentEditor,
        guildId:   guild.id,
      };
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error('[dashboard] Session-Regenerierungsfehler:', regenErr);
          res.status(500).send('Session error. Try again.');
          return;
        }
        req.session.user = newUser;
        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error('[dashboard] Session-Speicherfehler nach Auth:', saveErr);
            res.status(500).send('Session error. Try again.');
            return;
          }
          logger.info(`[dashboard] Login: ${discordUser.username} (Level ${effectivePerm})`);
          res.redirect('/');
        });
      });
```

- [ ] **Step 3: Add `session.regenerate()` in public callback in `src/dashboard/routes/auth.routes.ts`**

Find the public callback's success block (around lines 208-225):
```ts
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
```

Replace with:
```ts
      // Regenerate session ID to prevent session fixation, then store publicUser
      const newPublicUser = {
        userId:   discordUser.id,
        username: discordUser.global_name ?? discordUser.username,
        avatar:   discordUser.avatar,
        guildId:  guild.id,
      };
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error('[public-dashboard] Session-Regenerierungsfehler:', regenErr);
          res.status(500).send('Session error. Try again.');
          return;
        }
        req.session.publicUser = newPublicUser;
        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error('[public-dashboard] Session-Speicherfehler nach Auth:', saveErr);
            res.status(500).send('Session error. Try again.');
            return;
          }
          logger.info(`[public-dashboard] Public Login: ${discordUser.username}`);
          res.redirect('/public/');
        });
      });
```

- [ ] **Step 4: Add `DISCORD_CLIENT_SECRET` production check in `src/dashboard/server.ts`**

Find the existing session secret check block in `src/dashboard/server.ts` (around lines 35-40):
```ts
  // Guard against running with the default weak secret
  if (env.DASHBOARD_SESSION_SECRET === 'change-me-in-production') {
    logger.warn('[dashboard] WARNUNG: DASHBOARD_SESSION_SECRET ist der Standard-Wert. Bitte in .env setzen!');
    if (env.NODE_ENV === 'production') {
      throw new Error('DASHBOARD_SESSION_SECRET muss in Produktion gesetzt werden.');
    }
  }
```

After that block, add:
```ts
  // Guard against missing Discord client secret
  if (!env.DISCORD_CLIENT_SECRET) {
    logger.warn('[dashboard] WARNUNG: DISCORD_CLIENT_SECRET ist nicht gesetzt — OAuth-Login funktioniert nicht.');
    if (env.NODE_ENV === 'production') {
      throw new Error('DISCORD_CLIENT_SECRET muss in Produktion gesetzt werden.');
    }
  }
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/auth/discord-oauth.ts src/dashboard/routes/auth.routes.ts src/dashboard/server.ts
git commit -m "feat(security): crypto state nonce, session fixation fix, client secret check"
```

---

## Task 6: API Rate Limiting

**Files:**
- Modify: `src/dashboard/server.ts`

The existing `rateLimit()` helper is already used on `/auth` (10 req/min). The `/api` route has no limit. We apply a generous limit (100 req/min) to the whole API — tight enough to stop abuse, loose enough not to bother legitimate dashboard users.

- [ ] **Step 1: Add rate limit to `/api` in `src/dashboard/server.ts`**

Find the line:
```ts
  // Protected API routes — requireAuth then CSRF on mutations
  app.use('/api', requireAuth, doubleCsrfProtection, buildApiRouter(client));
```

Replace with:
```ts
  // Protected API routes — rate-limited (100/min), then auth + CSRF
  app.use('/api', rateLimit(100, 60_000), requireAuth, doubleCsrfProtection, buildApiRouter(client));
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/server.ts
git commit -m "feat(security): rate limit /api routes (100 req/min)"
```

---

## Task 7: Zod Shared Schemas + Audit Log Response Fix

**Files:**
- Create: `src/dashboard/routes/shared/schemas.ts`
- Modify: `src/dashboard/routes/api/logs.routes.ts`

The shared schemas file provides typed Discord-specific validators. Other route files already have reasonable manual validation; this task only creates the building blocks and fixes the audit log endpoint to not return raw change data.

- [ ] **Step 1: Create `src/dashboard/routes/shared/schemas.ts`**

```ts
// src/dashboard/routes/shared/schemas.ts
// Reusable zod schemas for dashboard API validation.

import { z } from 'zod';
import { env } from '../../../config/env';

/** 17-20 digit Discord snowflake */
export const DiscordSnowflake = z.string().regex(/^\d{17,20}$/, 'Must be a valid Discord snowflake ID');

/** Optional nullable snowflake — accepts string, null, or undefined */
export const NullableSnowflake = DiscordSnowflake.nullable().optional();

/** Non-empty string with max length */
export const NonEmptyStr = (max: number) =>
  z.string().min(1, `Required`).max(max, `Max ${max} characters`).trim();

/** Optional string with max length (empty string treated as null) */
export const OptionalStr = (max: number) =>
  z.string().max(max, `Max ${max} characters`).trim().optional().nullable();

/** Boolean-like: accepts true/false, 0/1 */
export const BooleanLike = z.union([z.boolean(), z.literal(0), z.literal(1)]);

/** Return a 400 JSON response from a zod SafeParseError. */
export function zodError(res: import('express').Response, error: z.ZodError): void {
  const details = env.NODE_ENV !== 'production' ? error.issues : undefined;
  res.status(400).json({ success: false, error: 'Invalid input', ...(details && { details }) });
}
```

- [ ] **Step 2: Strip `old_value`/`new_value` from audit log endpoint**

Open `src/dashboard/routes/api/logs.routes.ts`. Find the audit endpoint (lines 43-49):
```ts
logsRouter.get('/audit', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const limit   = parseLimitQuery(req.query.limit, 50, 1, 200);
    res.json({ success: true, data: getAuditLogs(guildId, limit) });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

Replace with:
```ts
logsRouter.get('/audit', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const limit   = parseLimitQuery(req.query.limit, 50, 1, 200);
    const rows    = getAuditLogs(guildId, limit);
    // Strip raw change payloads from the API response — use /api/logs/audit/:id for full details
    const safe = rows.map(({ old_value: _o, new_value: _n, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/routes/shared/schemas.ts src/dashboard/routes/api/logs.routes.ts
git commit -m "feat(security): shared zod schemas + strip change payloads from audit log endpoint"
```

---

## Task 8: Zod Validation on Settings Routes

**Files:**
- Modify: `src/dashboard/routes/api/settings.routes.ts`

This is the highest-value zod target: the `PATCH /guild` route accepts channel IDs and role IDs but currently only checks `typeof body[key] === 'string'` — it does not enforce that they are valid Discord snowflakes. A non-snowflake string would be written directly to the DB and used as a channel/role ID.

- [ ] **Step 1: Add zod imports to `src/dashboard/routes/api/settings.routes.ts`**

Open `src/dashboard/routes/api/settings.routes.ts`. After the existing imports, add:
```ts
import { z } from 'zod';
import { DiscordSnowflake, NullableSnowflake, zodError } from '../../shared/schemas';
```

- [ ] **Step 2: Add schema constants before the router definition**

After the `maskField` function (around line 17, before `export const settingsRouter = Router();`), add:
```ts
const GuildSettingsPatchSchema = z.object({
  ticket_panel_channel_id:   NullableSnowflake,
  ticket_category_id:        NullableSnowflake,
  ticket_log_channel_id:     NullableSnowflake,
  ticket_archive_channel_id: NullableSnowflake,
  rules_channel_id:          NullableSnowflake,
  whitelist_role_id:         NullableSnowflake,
}).strict();

const ScumSettingsPatchSchema = z.object({
  channel_id:           NullableSnowflake,
  host:                 z.string().max(253).nullable().optional(),
  query_port:           z.number().int().min(1).max(65535).nullable().optional(),
  update_interval_secs: z.number().int().min(5).max(3600).nullable().optional(),
  enabled:              z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
}).strict();
```

- [ ] **Step 3: Replace manual validation in `PATCH /guild`**

Find the `settingsRouter.patch('/guild', ...)` handler (starting around line 38). Replace its body with:
```ts
settingsRouter.patch('/guild', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const parsed  = GuildSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) { zodError(res, parsed.error); return; }
    const patch = parsed.data as Parameters<typeof upsertGuildConfig>[1];
    const old = getGuildConfig(guildId);
    upsertGuildConfig(guildId, patch);
    insertAuditLog({ guildId, adminUserId: user.userId, action: 'settings.guild.update', oldValue: old, newValue: { ...old, ...patch }, success: true, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    logger.error('[dashboard] settings update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
```

- [ ] **Step 4: Replace manual validation in `PATCH /scum`**

Find the `settingsRouter.patch('/scum', ...)` handler (starting around line 58). Replace its body with:
```ts
settingsRouter.patch('/scum', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const parsed  = ScumSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) { zodError(res, parsed.error); return; }
    const { enabled, ...rest } = parsed.data;
    const patch: Record<string, unknown> = { ...rest };
    if (enabled !== undefined) {
      patch.enabled = (enabled === true || enabled === 1) ? 1 : 0;
    }
    const old = getScumStatusConfig(guildId);
    upsertScumStatusConfig(guildId, patch as Parameters<typeof upsertScumStatusConfig>[1]);
    insertAuditLog({ guildId, adminUserId: user.userId, action: 'settings.scum.update', oldValue: old, newValue: { ...old, ...patch }, success: true, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    logger.error('[dashboard] settings update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Run existing tests**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/routes/api/settings.routes.ts
git commit -m "feat(security): zod validation on settings PATCH routes (snowflake enforcement)"
```

---

## Task 9: Security Tests

**Files:**
- Create: `src/dashboard/__tests__/security.test.ts`

These tests verify the security middleware layer end-to-end using supertest against a real Express app with an in-memory SQLite DB and MemoryStore sessions. A test helper endpoint (`GET /test/login`) injects a session user so we can test authenticated routes without a real Discord OAuth flow.

The test app deliberately does NOT include `buildPublicApiRouter` to keep the setup minimal, because those routes require a Discord client. Tests that need public routes create a second minimal app.

- [ ] **Step 1: Create the test directory**

```bash
mkdir -p "C:\Users\Administrator\Desktop\sectorbot\src\dashboard\__tests__"
```

- [ ] **Step 2: Create `src/dashboard/__tests__/security.test.ts`**

```ts
// src/dashboard/__tests__/security.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { Application } from 'express';
import { initDb, getDb } from '../../db/index';
import { requireAuth, rateLimit, PermLevel } from '../auth/middleware';
import { doubleCsrfProtection, generateToken } from '../auth/csrf';
import { buildApiRouter } from '../routes/api/index';
import { settingsRouter } from '../routes/api/settings.routes';
import type { DashboardUser } from '../auth/middleware';

// ─── Test app factory ──────────────────────────────────────────────────────────

const MOCK_USER: DashboardUser = {
  userId:          '123456789012345678',
  username:        'TestAdmin',
  avatar:          null,
  permLevel:       PermLevel.Admin,
  isContentEditor: false,
  guildId:         '987654321098765432',
};

function makeApp(): Application {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(session({
    secret:            'test-session-secret',
    resave:            false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false },
  }));

  // Test-only login helper — sets session user without OAuth
  app.get('/test/login', (req, res) => {
    req.session.user = MOCK_USER;
    req.session.save((err) => {
      if (err) { res.status(500).json({ error: 'session error' }); return; }
      res.json({ success: true });
    });
  });

  // Auth routes with rate limit (mirroring server.ts)
  app.use('/auth', rateLimit(10, 60_000), (req, res) => res.json({ path: req.path }));

  // API routes (mirrors server.ts)
  const mockClient = {
    guilds: { cache: { get: () => null, first: () => null, values: () => [][Symbol.iterator](), size: 0 } },
    ws:     { ping: 100 },
    user:   { tag: 'TestBot#0001', id: '000000000000000001' },
  } as never;
  app.use('/api', rateLimit(100, 60_000), requireAuth, doubleCsrfProtection, buildApiRouter(mockClient));

  return app;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  initDb(':memory:');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Authentication middleware', () => {
  it('returns 401 for unauthenticated GET /api/me', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'Not authenticated' });
  });

  it('returns 401 for unauthenticated POST /api/settings/guild', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/settings/guild').send({});
    expect(res.status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('blocks authenticated POST /api/settings/guild without CSRF token (403)', async () => {
    const app  = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');  // establish session

    const res = await agent
      .patch('/api/settings/guild')
      .send({ ticket_panel_channel_id: null });
    expect(res.status).toBe(403);
  });

  it('allows authenticated PATCH with valid CSRF token', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    // Fetch CSRF token (GET — not protected)
    const tokenRes = await agent.get('/api/csrf-token');
    expect(tokenRes.status).toBe(200);
    const { csrfToken } = tokenRes.body.data;
    expect(typeof csrfToken).toBe('string');

    // PATCH with valid token — should not be blocked by CSRF
    // (will get 500 if DB upsert fails, but NOT 403)
    const patchRes = await agent
      .patch('/api/settings/guild')
      .set('X-CSRF-Token', csrfToken)
      .send({ ticket_panel_channel_id: null });
    expect(patchRes.status).not.toBe(403);
  });
});

describe('Rate limiting', () => {
  it('returns 429 after 11 rapid requests to /auth/login', async () => {
    const app = makeApp();
    const responses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await request(app).get('/auth/login');
      responses.push(r.status);
    }
    expect(responses).toContain(429);
  });
});

describe('Input validation (zod)', () => {
  it('returns 400 when ticket_panel_channel_id is not a snowflake', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    const tokenRes = await agent.get('/api/csrf-token');
    const { csrfToken } = tokenRes.body.data;

    const res = await agent
      .patch('/api/settings/guild')
      .set('X-CSRF-Token', csrfToken)
      .send({ ticket_panel_channel_id: 'not-a-snowflake' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid input' });
  });

  it('accepts null for ticket_panel_channel_id (valid nullable snowflake)', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    const tokenRes = await agent.get('/api/csrf-token');
    const { csrfToken } = tokenRes.body.data;

    const res = await agent
      .patch('/api/settings/guild')
      .set('X-CSRF-Token', csrfToken)
      .send({ ticket_panel_channel_id: null });
    // DB upsert succeeds (no snowflake to write), should be 200
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('Audit log', () => {
  it('writes an audit log row when PATCH /api/settings/guild succeeds', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    const tokenRes = await agent.get('/api/csrf-token');
    const { csrfToken } = tokenRes.body.data;

    await agent
      .patch('/api/settings/guild')
      .set('X-CSRF-Token', csrfToken)
      .send({ ticket_panel_channel_id: null })
      .expect(200);

    const rows = getDb()
      .prepare(`SELECT * FROM dashboard_audit_logs WHERE action = 'settings.guild.update'`)
      .all() as Array<{ admin_user_id: string; success: number }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.admin_user_id).toBe(MOCK_USER.userId);
    expect(rows[0]!.success).toBe(1);
  });
});

describe('Security headers', () => {
  it('sets X-Frame-Options header on all responses', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/me');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
```

- [ ] **Step 3: Run the new tests**

```bash
npm test -- src/dashboard/__tests__/security.test.ts
```

Expected: all 9 tests pass.

If you see `Error: Datenbank nicht initialisiert` — the `getDb()` call in a route handler is running before `initDb(':memory:')` in `beforeEach`. Fix: call `initDb(':memory:')` at the top of `makeApp()` body instead of (or in addition to) `beforeEach`. Alternatively, ensure vitest runs tests serially for this file by adding:

```ts
// At the top of the test file, after imports:
// (vitest runs beforeEach serially, but if DB calls happen at module parse time, move initDb into makeApp)
```

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
npm test
```

Expected: all existing tests pass and the new 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/__tests__/security.test.ts
git commit -m "test(security): add 9 security tests for auth, CSRF, rate-limit, validation, headers"
```

---

## Task 10: Write docs/SECURITY.md

**Files:**
- Create: `docs/SECURITY.md`

- [ ] **Step 1: Create `docs/SECURITY.md`**

```markdown
# Security — sectorbot Admin Dashboard

## Session Configuration

| Setting | Value |
|---------|-------|
| Store | SQLite (`data/dashboard-sessions.db`) |
| Cookie | `httpOnly: true`, `sameSite: lax`, `secure: true` in production |
| Max age | 24 hours |
| Secret | `DASHBOARD_SESSION_SECRET` env var — must be set in production |

Session IDs are regenerated on successful login (prevents session fixation).

## CSRF Protection

All state-mutating API routes (`POST`, `PATCH`, `PUT`, `DELETE` under `/api/*`) require a valid CSRF token.

**Flow:**
1. SPA calls `GET /api/csrf-token` on load — receives `csrfToken` string in JSON response.
2. SPA stores the token in memory.
3. SPA sends `X-CSRF-Token: <token>` header on all mutating requests.
4. Server validates header against the signed `__csrf` cookie (double-submit cookie pattern via `csrf-csrf`).

Requests without a valid token are rejected with `403 { success: false, error: 'CSRF token mismatch' }`.

Public API endpoints (`/public-api/*`) and OAuth redirect endpoints (`/auth/*`) are not protected by CSRF.

## Rate Limits

| Route | Limit |
|-------|-------|
| `/auth/*` | 10 requests / minute per IP |
| `/api/*` | 100 requests / minute per IP |

Rate limits are enforced by an in-process Map-based limiter. They reset on server restart and do not work across multiple processes. For high-availability deployments, replace with a Redis-backed limiter.

## Admin Permissions

| Level | Value | Access |
|-------|-------|--------|
| Viewer | 1 | Authenticated, read-only |
| Moderator | 2 | Tickets, logs, members |
| Admin | 3 | Settings, all admin routes |
| Owner | 4 | Destructive actions (cache-clear, sync-import) |
| Content Editor | flag | Content CRUD regardless of level |

Set via environment:
- `DASHBOARD_ALLOWED_USER_IDS` — comma-separated Discord user IDs that get Owner access
- `DASHBOARD_ADMIN_ROLE_IDS` — role IDs that get Admin access
- `DASHBOARD_MOD_ROLE_IDS` — role IDs that get Moderator access
- `DASHBOARD_EDITOR_ROLE_IDS` — role IDs that get the Content Editor flag

## Audit Logs

All admin mutations are logged to the `dashboard_audit_logs` SQLite table. Logged fields:

| Field | Description |
|-------|-------------|
| `guild_id` | Discord guild ID |
| `admin_user_id` | Discord user ID of the acting admin |
| `action` | String like `settings.guild.update`, `rules.delete` |
| `target_type` | Object type (`rule`, `setting`, `event`, etc.) |
| `target_id` | DB row ID or string identifier |
| `success` | 0 or 1 |
| `ip_address` | Client IP (respects `trust proxy`) |
| `created_at` | Unix timestamp |

Fields containing `secret`, `key`, `token`, or `password` in their key names are automatically redacted to `[REDACTED]` before storage. Discord access tokens are never logged.

View audit logs: `GET /api/logs/audit?limit=50` (requires Admin permission).

## Security Headers

Applied globally via `helmet`:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (production only)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — same-origin default with `unsafe-inline` for scripts/styles (SPA requirement)

## OAuth (Discord)

- State parameter: 64-character cryptographically random hex string (`crypto.randomBytes(32)`)
- State is stored in session, validated on callback
- Failed state validation redirects to `/auth/denied?reason=invalid_state`
- Session ID is regenerated after successful login (session fixation prevention)
- Access tokens are exchanged server-side only — never exposed to the browser

## Production Environment

Required `.env` variables for production:

```env
NODE_ENV=production
DASHBOARD_SESSION_SECRET=<64+ char random hex — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DISCORD_CLIENT_SECRET=<from Discord Developer Portal>
DISCORD_OAUTH_CALLBACK_URL=https://yourdomain.com/auth/callback
PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL=https://yourdomain.com/auth/public/callback
DASHBOARD_ALLOWED_USER_IDS=<comma-separated Discord user IDs for Owner access>
DASHBOARD_ADMIN_ROLE_IDS=<comma-separated role IDs>
DASHBOARD_MOD_ROLE_IDS=<comma-separated role IDs>
DASHBOARD_EDITOR_ROLE_IDS=<comma-separated role IDs>
```

## Known Limitations

1. **No token refresh**: Discord OAuth access tokens expire after 7 days. Sessions can outlive their token. The bot's member-check at login does not re-check on every request.
2. **In-process rate limiter**: Resets on restart, not shared across processes.
3. **Single-guild assumption**: Auth uses `client.guilds.cache.first()` — multi-guild deployments would need a guild-selection step.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SECURITY.md
git commit -m "docs: add SECURITY.md for dashboard session, CSRF, rate limits, audit logs"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Covered by task |
|---|---|
| Helmet / security headers | Task 2 ✅ |
| CORS (same-origin, no explicit middleware) | Documented in SECURITY.md ✅ |
| Session cookie config | Already in place; Task 5 adds prod check + regenerate ✅ |
| Production secret checks | Task 5 ✅ |
| CSRF on mutating admin routes | Tasks 3+4 ✅ |
| CSRF token endpoint for SPA | Task 4 ✅ |
| Crypto-secure OAuth state | Task 5 ✅ |
| Session fixation fix | Task 5 ✅ |
| Rate limiting on /api | Task 6 ✅ |
| Zod shared schemas | Task 7 ✅ |
| Zod on settings PATCH | Task 8 ✅ |
| Audit log consistency | All admin routes already have it; Task 7 strips raw payloads from endpoint ✅ |
| Audit log read endpoint | Already exists at GET /api/logs/audit; Task 7 fixes response ✅ |
| Public API error leak review | All catch blocks already use generic 'Internal error' ✅ |
| Tests | Task 9 ✅ |
| SECURITY.md | Task 10 ✅ |

**Placeholder scan:** No TBDs found.

**Type consistency:** `DashboardUser`, `PermLevel`, `generateToken`, `doubleCsrfProtection`, `DiscordSnowflake`, `NullableSnowflake`, `zodError` — all defined in Tasks 3/7 and referenced consistently in Tasks 4/8/9.
