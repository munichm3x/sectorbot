// src/dashboard/routes/public-api/tickets.ts
// GET /public-api/tickets/mine       — list user's own tickets (paginated, 25/page)
// GET /public-api/tickets/mine/:id   — single ticket (ownership enforced at DB level)
//
// Security: opener_user_id filter applied in SQL, not in application code.
// A user cannot read another user's ticket by guessing an ID.

import { Router } from 'express';
import { getDb } from '../../../db/index';
import { parseEnumQuery, parsePageQuery, parsePositiveIntParam, parseSearchQuery } from '../shared/request-validators';

export const publicTicketsRouter = Router();

// GET /public-api/tickets/mine?status=open|closed|all&page=1&search=
publicTicketsRouter.get('/mine', (req, res) => {
  try {
    const guildId = req.session.publicUser!.guildId;
    const userId  = req.session.publicUser!.userId;
    const status  = parseEnumQuery(req.query.status, ['open', 'closed', 'all'] as const, 'all');
    const page    = parsePageQuery(req.query.page, 1, 10_000);
    const search  = parseSearchQuery(req.query.search, 120);
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
      `SELECT id, guild_id, status, category, created_at, closed_at
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
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }
    const db     = getDb();
    const ticket = db.prepare(
      `SELECT id, guild_id, status, category, created_at, closed_at
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
