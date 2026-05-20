// src/dashboard/routes/api/tickets.routes.ts
import { Router } from 'express';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { getDb } from '../../../db/index';

export const ticketsRouter = Router();
ticketsRouter.use(requirePermission(PermLevel.Moderator));

ticketsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const status  = (req.query.status as string) ?? 'all';
    const page    = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit   = 25;
    const offset  = (page - 1) * limit;
    const search  = (req.query.search as string) ?? '';
    const db      = getDb();

    if (status === 'open') {
      const tickets = db.prepare(`SELECT * FROM tickets WHERE guild_id = ? AND status = 'open' ORDER BY created_at DESC`).all(guildId);
      res.json({ success: true, data: { tickets, total: (tickets as unknown[]).length, page: 1, pages: 1 } });
      return;
    }

    const lp = search ? `%${search}%` : null;
    const total = search
      ? (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND (CAST(id AS TEXT) LIKE ? OR opener_user_id LIKE ? OR closed_by LIKE ? OR category LIKE ? OR summary LIKE ? OR username_snapshot LIKE ? OR closed_by_username_snapshot LIKE ?)`).get(guildId, lp, lp, lp, lp, lp, lp, lp) as { n: number }).n
      : (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;

    const tickets = search
      ? db.prepare(`SELECT * FROM tickets WHERE guild_id = ? AND status = 'closed' AND (CAST(id AS TEXT) LIKE ? OR opener_user_id LIKE ? OR closed_by LIKE ? OR category LIKE ? OR summary LIKE ? OR username_snapshot LIKE ? OR closed_by_username_snapshot LIKE ?) ORDER BY COALESCE(closed_at, created_at) DESC LIMIT ? OFFSET ?`).all(guildId, lp, lp, lp, lp, lp, lp, lp, limit, offset)
      : db.prepare(`SELECT * FROM tickets WHERE guild_id = ? AND status = 'closed' ORDER BY COALESCE(closed_at, created_at) DESC LIMIT ? OFFSET ?`).all(guildId, limit, offset);

    res.json({ success: true, data: { tickets, total, page, pages: Math.ceil(total / limit) } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

ticketsRouter.get('/:id', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const ticket = getDb().prepare(`SELECT * FROM tickets WHERE id = ? AND guild_id = ?`).get(id, guildId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: ticket });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
