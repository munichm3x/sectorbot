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
