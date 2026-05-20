// src/dashboard/routes/api/tickets.routes.ts
import { Router } from 'express';
import {
  getRecentClosedTickets, countClosedTickets, searchClosedTickets,
  countSearchClosedTickets, getClosedTicketById, getDb,
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
    const id       = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const ticket   = getClosedTicketById(id, guildId);
    if (!ticket)   { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: ticket });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
