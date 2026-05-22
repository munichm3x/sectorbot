import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  getFilteredTickets, countFilteredTickets, getClosedTicketById,
  getTicketNotes, createTicketNote, deleteTicketNote,
  type TicketFilters,
} from '../../../db/index';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { parsePageQuery, parsePositiveIntParam } from '../shared/request-validators';

export const ticketsRouter = Router();

ticketsRouter.use(requirePermission(PermLevel.Moderator));

// ─── GET /api/tickets ─────────────────────────────────────────────────────────
ticketsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const page    = parsePageQuery(req.query.page, 1, 10_000);
    const limit   = 25;
    const offset  = (page - 1) * limit;

    const filters: TicketFilters = {};
    if (typeof req.query.status   === 'string' && req.query.status)   filters.status    = req.query.status;
    if (typeof req.query.priority === 'string' && req.query.priority) filters.priority  = req.query.priority;
    if (typeof req.query.category === 'string' && req.query.category) filters.category  = req.query.category;
    if (typeof req.query.claimed_by === 'string' && req.query.claimed_by) filters.claimedBy = req.query.claimed_by;
    if (typeof req.query.creator  === 'string' && req.query.creator)  filters.creator   = req.query.creator;
    if (typeof req.query.tags     === 'string' && req.query.tags)     filters.tags      = req.query.tags;
    if (typeof req.query.search   === 'string' && req.query.search)   filters.search    = req.query.search.slice(0, 120);
    if (typeof req.query.date_from === 'string' && req.query.date_from) {
      const ts = Math.floor(new Date(req.query.date_from).getTime() / 1000);
      if (!isNaN(ts)) filters.dateFrom = ts;
    }
    if (typeof req.query.date_to === 'string' && req.query.date_to) {
      const ts = Math.floor(new Date(req.query.date_to + 'T23:59:59Z').getTime() / 1000);
      if (!isNaN(ts)) filters.dateTo = ts;
    }

    const total   = countFilteredTickets(guildId, filters);
    const tickets = getFilteredTickets(guildId, filters, limit, offset).map(t => ({
      ...t,
      has_transcript: !!t.transcript_path,
    }));

    res.json({ success: true, data: { tickets, total, page, pages: Math.ceil(total / limit) } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── GET /api/tickets/:id ────────────────────────────────────────────────────
ticketsRouter.get('/:id', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const notes = getTicketNotes(ticket.id, guildId).map(n => ({
      id:        n.id,
      authorId:  n.author_id,
      authorTag: n.author_tag,
      content:   n.content,
      createdAt: n.created_at,
    }));

    res.json({
      success: true,
      data: { ...ticket, notes, has_transcript: !!ticket.transcript_path },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── GET /api/tickets/:id/transcript ─────────────────────────────────────────
ticketsRouter.get('/:id/transcript', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket || !ticket.transcript_path) {
      res.status(404).json({ success: false, error: 'Transcript not found' });
      return;
    }

    const absPath = join(process.cwd(), 'data', ticket.transcript_path);
    if (!existsSync(absPath)) {
      res.status(404).json({ success: false, error: 'Transcript file missing' });
      return;
    }

    const html = readFileSync(absPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── POST /api/tickets/:id/notes ─────────────────────────────────────────────
const noteBodySchema = z.object({
  content: z.string().min(1).max(1000),
});

ticketsRouter.post('/:id/notes', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const userId  = req.session.user!.userId;
    const userTag = req.session.user!.username;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const parsed = noteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      return;
    }

    const note = createTicketNote({
      ticket_id:  ticket.id,
      guild_id:   guildId,
      author_id:  userId,
      author_tag: userTag,
      content:    parsed.data.content,
      created_at: Math.floor(Date.now() / 1000),
    });

    res.status(201).json({ success: true, data: note });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── DELETE /api/tickets/:id/notes/:noteId ───────────────────────────────────
ticketsRouter.delete('/:id/notes/:noteId', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const noteId  = parsePositiveIntParam(req.params.noteId);
    if (!noteId) { res.status(400).json({ success: false, error: 'Invalid note ID' }); return; }

    deleteTicketNote(noteId, guildId);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
