import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { initDb, createTicket, getDb } from '../../db/index';
import { ticketsRouter } from '../routes/api/tickets.routes';
import { PermLevel } from '../auth/middleware';
import type { DashboardUser } from '../auth/middleware';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const MOD_USER: DashboardUser = {
  userId: 'mod1', username: 'Mod#0001', avatar: null,
  permLevel: PermLevel.Moderator, isContentEditor: false, guildId: 'g1',
};
const ADMIN_USER: DashboardUser = {
  userId: 'adm1', username: 'Admin#0001', avatar: null,
  permLevel: PermLevel.Admin, isContentEditor: false, guildId: 'g1',
};

function makeApp(user: DashboardUser | null = MOD_USER) {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test', resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false },
  }));
  if (user) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.session.user = user;
      next();
    });
  }
  app.use('/api/tickets', ticketsRouter);
  return app;
}

const TMP = join(process.cwd(), 'tmp-tickets-api-test-' + Date.now());

beforeEach(() => {
  initDb(':memory:');
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('GET /api/tickets', () => {
  it('returns 403 without session (requirePermission returns 403 for unauthenticated)', async () => {
    const res = await request(makeApp(null)).get('/api/tickets');
    expect(res.status).toBe(403);
  });

  it('returns ticket list with default filters', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tickets).toHaveLength(1);
  });

  it('filters by priority', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET priority = 'high' WHERE channel_id = 'c1'`).run();
    createTicket({ guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1', category: 'ban', created_at: 1000 });

    const res = await request(makeApp()).get('/api/tickets?priority=high');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].priority).toBe('high');
  });

  it('filters by category', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban',       created_at: 1000 });
    createTicket({ guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1', category: 'whitelist', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets?category=ban');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].category).toBe('ban');
  });

  it('includes has_transcript flag', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets[0]).toHaveProperty('has_transcript');
  });
});

describe('GET /api/tickets/:id', () => {
  it('returns ticket with notes array', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });

    const res = await request(makeApp()).get(`/api/tickets/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toEqual([]);
    expect(res.body.data).toHaveProperty('has_transcript');
  });

  it('returns 404 for unknown ticket', async () => {
    const res = await request(makeApp()).get('/api/tickets/99999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/tickets/:id/transcript', () => {
  it('returns 404 when transcript_path is null', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp()).get(`/api/tickets/${t.id}/transcript`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tickets/:id/notes', () => {
  it('creates a note and returns 201', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });

    const res = await request(makeApp())
      .post(`/api/tickets/${t.id}/notes`)
      .send({ content: 'Testnotiz vom Dashboard' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Testnotiz vom Dashboard');
  });

  it('rejects empty content', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp())
      .post(`/api/tickets/${t.id}/notes`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tickets/:id/notes/:noteId', () => {
  it('requires Admin permission (Moderator gets 403)', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const noteResult = getDb()
      .prepare(`INSERT INTO ticket_notes (ticket_id, guild_id, author_id, author_tag, content, created_at) VALUES (?, 'g1', 'm1', 'Mod#0001', 'Notiz', 1000)`)
      .run(t.id);
    const noteId = noteResult.lastInsertRowid;

    const res = await request(makeApp(MOD_USER))
      .delete(`/api/tickets/${t.id}/notes/${noteId}`);
    expect(res.status).toBe(403);
  });

  it('deletes note as Admin', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const noteResult = getDb()
      .prepare(`INSERT INTO ticket_notes (ticket_id, guild_id, author_id, author_tag, content, created_at) VALUES (?, 'g1', 'a1', 'A#0001', 'Notiz', 1000)`)
      .run(t.id);
    const noteId = noteResult.lastInsertRowid;

    const res = await request(makeApp(ADMIN_USER))
      .delete(`/api/tickets/${t.id}/notes/${noteId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
