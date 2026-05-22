# Security Hardening Design — Admin Dashboard & API Routes

**Date:** 2026-05-22  
**Scope:** `src/dashboard/` only — no bot logic, no UI redesign, no data loss  
**Approach:** Layered, non-invasive hardening. Each layer is independently testable.

---

## Current State (baseline)

### Already in place
- Session cookies: `httpOnly`, `sameSite: lax`, `secure` in production
- Session secret production guard (throws on default value)
- `requireAuth` middleware on all `/api/*` routes
- `requirePermission(PermLevel.X)` on each sub-router
- `requireContentEditor` for content CRUD routes
- Rate limiting on `/auth` routes (10 req/min per IP)
- OAuth state parameter generated and validated
- Audit log infrastructure: `insertAuditLog()` + `dashboard_audit_logs` DB table
- Secret key masking in audit log values
- Basic input validators in `request-validators.ts`
- Global error handler that returns generic 500 (no stack traces)

### Identified gaps
1. No security headers (no Helmet)
2. No CSRF protection on mutating admin routes
3. `generateState()` uses `Math.random()` (not cryptographically secure)
4. Session fixation: no `session.regenerate()` on login
5. No rate limiting on `/api/*` routes
6. `DISCORD_CLIENT_SECRET` not validated in production
7. Some admin routes missing audit log calls
8. Ad-hoc input validation (no Discord snowflake format enforcement)
9. No security tests

---

## Section 1: Security Headers + CORS + Rate Limiting

### Security Headers (Helmet)
- Install `helmet` as a production dependency
- Mount `helmet()` as the first middleware in `server.ts`
- Sets: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 0`, basic CSP (same-origin)

### CORS Policy
- The dashboard is same-origin (SPA served from the same Express server)
- No CORS headers needed; we explicitly block cross-origin requests by not adding any CORS middleware
- Document this decision so future contributors don't accidentally add CORS

### Rate Limiting Extension
- Existing `rateLimit()` function in `middleware.ts` is reused — no new library needed
- Apply `rateLimit(100, 60_000)` to all `/api/*` routes (general protection)
- Apply tighter `rateLimit(30, 60_000)` inside each mutating admin sub-router
- Existing `/auth` rate limit (10/min) stays unchanged

---

## Section 2: CSRF Protection

### Library
- `csrf-csrf` package (double-submit cookie pattern, actively maintained)

### Implementation
- Add `doubleCsrf()` configuration in a new `src/dashboard/auth/csrf.ts`
- Mount CSRF middleware on the `/api` router in `server.ts` (after `requireAuth`)
- CSRF only applies to state-mutating methods: `POST`, `PATCH`, `PUT`, `DELETE`
- GET requests are unaffected (safe methods)

### Token flow
- `GET /api/csrf-token` — new endpoint that returns the current CSRF token for the session
- Frontend SPA calls this on load and stores the token
- Frontend sends `X-CSRF-Token: <token>` header on all mutating requests
- CSRF middleware rejects requests without a valid token with `403 { success: false, error: 'CSRF token mismatch' }`

### Scope
- Applies to: all `/api/*` mutation routes (settings, rules, events, changelog, etc.)
- Does NOT apply to: `/auth/*` (only GETs), `/public-api/*` (read-only public data)

---

## Section 3: OAuth Hardening + Session Fixation

### Cryptographic state nonce
- `generateState()` in `discord-oauth.ts` replaces `Math.random()` with `crypto.randomBytes(32).toString('hex')`
- State is still stored in session and validated on callback — same flow, stronger nonce

### Session fixation prevention
- In `auth.routes.ts`, after successful OAuth validation but before writing the user object:
  ```ts
  req.session.regenerate((err) => {
    if (err) { /* handle */ return; }
    req.session.user = { ... };
    req.session.save(...);
  });
  ```
- Same pattern applied to `public/callback` for the public dashboard login

### Production secret checks
- In `server.ts` startup, add check: `DISCORD_CLIENT_SECRET` must not be empty in production
- Already exists for `DASHBOARD_SESSION_SECRET` — mirror the pattern

---

## Section 4: Input Validation with Zod

### Strategy
- Add `zod` as a production dependency
- Create `src/dashboard/routes/shared/schemas.ts` with reusable building blocks
- Each mutation route file gets a zod schema at the top
- Call `z.safeParse(req.body)` — on failure return `400 { success: false, error: 'Invalid input', details: zodError.issues }` in development, `400 { success: false, error: 'Invalid input' }` in production
- Read-only GET routes keep the existing lightweight validators

### Shared schemas (`schemas.ts`)
```ts
export const DiscordSnowflake = z.string().regex(/^\d{17,20}$/);
export const NullableSnowflake = DiscordSnowflake.nullable().optional();
export const NonEmptyStr = (max: number) => z.string().min(1).max(max).trim();
export const OptionalStr = (max: number) => z.string().max(max).trim().optional();
export const BooleanLike = z.union([z.boolean(), z.literal(0), z.literal(1)]);
```

### Routes receiving zod schemas
- `settings.routes.ts` — PATCH `/guild` (channel IDs enforced as snowflakes)
- `settings.routes.ts` — PATCH `/scum` (host string, port range, interval range)
- `rules.routes.ts` — POST / PATCH (convert existing manual checks to zod)
- `bot-settings.routes.ts` — PATCH (category enum, settings array items)
- `events.routes.ts`, `changelog.routes.ts`, `announcements.routes.ts`, `faq.routes.ts` — POST / PATCH / DELETE
- `wipe.routes.ts`, `server-info.routes.ts` — PATCH

---

## Section 5: Audit Log Consistency

### Current coverage
- ✅ `settings.routes.ts` — has `insertAuditLog` calls
- ✅ `rules.routes.ts` — has `insertAuditLog` calls
- ✅ `bot-settings.routes.ts` — has `insertAuditLog` calls
- ❌ `events.routes.ts`, `changelog.routes.ts`, `announcements.routes.ts`, `faq.routes.ts`, `wipe.routes.ts`, `server-info.routes.ts`, `system.routes.ts`, `public-preview.routes.ts` — need audit calls added

### Audit log read endpoint
- `GET /api/audit-logs?limit=100` — returns recent audit log rows for the session's guild
- Requires `PermLevel.Admin`
- Returns: `id, action, targetType, targetId, success, ipAddress, createdAt` (never `oldValue`/`newValue` raw)
- Paginatable

### Privacy rules (already enforced, verified)
- `maskSecretKeys()` strips fields containing `secret`, `key`, `token`, `password` from logged values
- No Discord access tokens stored in audit logs

---

## Section 6: Public API Review

### Review findings
- All public endpoints only return public-filtered data (`publicOnly: true` filter applied)
- `/me` exposes the authenticated user's own `userId` — acceptable since the user authenticated themselves
- `/me/whitelist-status` returns boolean only (no role IDs)
- `/support` exposes ticket category keys/labels — no sensitive config
- Error handlers return `{ success: false, error: 'Internal error' }` — no internal detail leakage

### One fix needed
- Verify all `catch {}` blocks in `public-api/` do not reference `err` in the response
- Replace any `catch (err) { res.json({ error: err.message }) }` patterns with generic messages

---

## Section 7: Tests

### Setup
- Add `supertest` as a dev dependency
- New file: `src/dashboard/__tests__/security.test.ts`
- Uses vitest + supertest against a real in-memory Express app with a mock session/DB

### Test cases
1. **Unauthenticated → 401**: GET `/api/me` without session returns `{ success: false, error: 'Not authenticated' }`
2. **Unauthenticated → 401 on mutation**: POST `/api/rules` without session returns 401
3. **CSRF missing → 403**: Authenticated POST `/api/settings/guild` without CSRF header returns 403
4. **CSRF valid → passes CSRF gate**: Authenticated POST with valid `X-CSRF-Token` passes CSRF check
5. **Rate limit → 429**: 11 rapid requests to `/auth/login` results in 429 on the 11th
6. **Invalid input → 400**: PATCH `/api/settings/guild` with `{ ticket_panel_channel_id: 'not-a-snowflake' }` returns 400
7. **Public API works unauthenticated**: GET `/public-api/rules` returns 200 without any session
8. **Audit log written**: Authenticated PATCH `/api/settings/guild` writes a row to `dashboard_audit_logs`

---

## New Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `helmet` | prod | Security headers |
| `csrf-csrf` | prod | CSRF double-submit cookie |
| `zod` | prod | Schema-based input validation |
| `supertest` | dev | HTTP test client |

---

## Files to Change

| File | Change |
|------|--------|
| `src/dashboard/server.ts` | Add helmet, CSRF middleware, prod secret check, API rate limit |
| `src/dashboard/auth/discord-oauth.ts` | Replace `Math.random()` state with `crypto.randomBytes` |
| `src/dashboard/auth/middleware.ts` | No changes (CSRF goes in new csrf.ts) |
| `src/dashboard/auth/csrf.ts` | **New** — `doubleCsrf` config + `GET /csrf-token` handler |
| `src/dashboard/routes/auth.routes.ts` | Add `session.regenerate()` on login/callback |
| `src/dashboard/routes/shared/schemas.ts` | **New** — reusable zod schemas |
| `src/dashboard/routes/api/settings.routes.ts` | Zod validation on PATCH routes |
| `src/dashboard/routes/api/admin/*.routes.ts` | Audit log calls + zod validation |
| `src/dashboard/__tests__/security.test.ts` | **New** — security test suite |
| `docs/SECURITY.md` | **New** — security documentation |
| `package.json` | Add helmet, csrf-csrf, zod, supertest |

---

## Open Risks (post-implementation)

1. **No refresh token handling**: Discord access tokens expire after 7 days. Sessions currently never refresh the token. A user can keep a session alive past token expiry. Mitigation: document this limitation; fix in a separate task.
2. **Single-guild assumption**: Auth code uses `client.guilds.cache.first()` — if the bot is ever in multiple guilds, this could grant incorrect permissions. Document this as a known constraint.
3. **In-process rate limiter**: The existing `rateLimit()` is in-process (Map). It resets on bot restart and doesn't work across multiple processes. For production resilience, Redis-backed rate limiting would be better.

---

## Production Environment Checklist (.env)

```env
NODE_ENV=production
DASHBOARD_SESSION_SECRET=<64-char random hex>
DISCORD_CLIENT_SECRET=<from Discord Developer Portal>
DISCORD_OAUTH_CALLBACK_URL=https://yourdomain.com/auth/callback
PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL=https://yourdomain.com/auth/public/callback
DASHBOARD_ALLOWED_USER_IDS=<comma-separated Discord user IDs>
DASHBOARD_ADMIN_ROLE_IDS=<comma-separated role IDs>
DASHBOARD_MOD_ROLE_IDS=<comma-separated role IDs>
DASHBOARD_EDITOR_ROLE_IDS=<comma-separated role IDs>
```
