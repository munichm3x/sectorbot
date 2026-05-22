// src/dashboard/routes/api/tickets.routes.ts
import { Router } from 'express';
import {
  getRecentClosedTickets, countClosedTickets, searchClosedTickets,
  countSearchClosedTickets, getClosedTicketById, getDb,
} from '../../../db/index';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { parseEnumQuery, parsePageQuery, parsePositiveIntParam, parseSearchQuery } from '../shared/request-validators';

export const ticketsRouter = Router();

ticketsRouter.use(requirePermission(PermLevel.Moderator));

// GET /api/tickets?status=open|closed|all&page=1&search=
ticketsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const status  = parseEnumQuery(req.query.status, ['open', 'closed', 'all'] as const, 'all');
    const page    = parsePageQuery(req.query.page, 1, 10_000);
    const limit   = 25;
    const offset  = (page - 1) * limit;
    const search  = parseSearchQuery(req.query.search, 120);

    if (status === 'open') {
      const db = getDb();
      const total = (db.prepare(
        `SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`
      ).get(guildId) as { n: number }).n;
      const tickets = db.prepare(
        `SELECT * FROM tickets WHERE guild_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(guildId, limit, offset) as unknown[];
      res.json({ success: true, data: { tickets, total, page, pages: Math.ceil(total / limit) } });
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
    const id       = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const ticket   = getClosedTicketById(id, guildId);
    if (!ticket)   { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: ticket });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
