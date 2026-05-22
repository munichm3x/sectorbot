// src/dashboard/__tests__/security.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { Application } from 'express';
import { initDb, getDb } from '../../db/index';
import { requireAuth, rateLimit, PermLevel } from '../auth/middleware';
import { doubleCsrfProtection, generateToken } from '../auth/csrf';
import { buildApiRouter } from '../routes/api/index';
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

  // Minimal cookie parser — csrf-csrf reads req.cookies[cookieName]
  // cookie-parser is not installed, so we parse inline
  app.use((req, _res, next) => {
    const raw = req.headers.cookie ?? '';
    const cookies: Record<string, string> = {};
    for (const part of raw.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
    }
    (req as Record<string, unknown>).cookies = cookies;
    next();
  });

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

  // Error handler — must come after routes; handles CSRF errors (403) and others
  app.use((err: Record<string, unknown>, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err['statusCode'] ?? err['status'] ?? 500) as number;
    res.status(status).json({ success: false, error: err['message'] ?? 'Internal server error' });
  });

  return app;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

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
  it('blocks authenticated PATCH /api/settings/guild without CSRF token (403)', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    const res = await agent
      .patch('/api/settings/guild')
      .send({ ticket_panel_channel_id: null });
    expect(res.status).toBe(403);
  });

  it('allows authenticated PATCH with valid CSRF token (not 403)', async () => {
    const app   = makeApp();
    const agent = request.agent(app);
    await agent.get('/test/login');

    // Fetch CSRF token (GET — not protected by CSRF)
    const tokenRes = await agent.get('/api/csrf-token');
    expect(tokenRes.status).toBe(200);
    const { csrfToken } = tokenRes.body.data;
    expect(typeof csrfToken).toBe('string');

    // PATCH with valid token — should not be blocked by CSRF
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
