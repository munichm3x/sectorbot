// src/dashboard/routes/api/admin/events.routes.ts
import { Router } from 'express';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import {
  listPublicEvents, getPublicEvent, createPublicEvent, updatePublicEvent, deletePublicEvent,
} from '../../../../db/index';

export const eventsAdminRouter = Router();
eventsAdminRouter.use(requirePermission(PermLevel.Moderator));

const VALID_EVENT_TYPES = ['pvp', 'raid', 'solo', 'airfield', 'bunker', 'trader', 'meeting', 'wipe', 'community'];
const VALID_STATUSES = ['draft', 'scheduled', 'live', 'ended', 'cancelled'];

// GET /api/events — list all (admin view, includes non-public)
eventsAdminRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    res.json({ success: true, data: listPublicEvents(guildId) });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// GET /api/events/:id
eventsAdminRouter.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const event = getPublicEvent(id);
    if (!event || event.guild_id !== req.session.user!.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: event });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/events — create
eventsAdminRouter.post('/', (req, res) => {
  try {
    const user = req.session.user!;
    const body = req.body as {
      title?: string;
      starts_at?: number;
      description?: string;
      event_type?: string;
      ends_at?: number;
      status?: string;
      discord_url?: string;
      banner_url?: string;
      public_visible?: number;
    };

    if (!body.title || typeof body.title !== 'string' || body.title.length === 0 || body.title.length > 200) {
      res.status(400).json({ success: false, error: 'Title required (1-200 chars)' });
      return;
    }
    if (typeof body.starts_at !== 'number' || !Number.isFinite(body.starts_at)) {
      res.status(400).json({ success: false, error: 'starts_at required (unix seconds)' });
      return;
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 4000)) {
      res.status(400).json({ success: false, error: 'description max 4000 chars' });
      return;
    }
    if (body.event_type !== undefined && !VALID_EVENT_TYPES.includes(body.event_type)) {
      res.status(400).json({ success: false, error: 'Invalid event_type' });
      return;
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const created = createPublicEvent({
      guild_id: user.guildId,
      title: body.title,
      starts_at: body.starts_at,
      description: body.description ?? null,
      event_type: body.event_type,
      ends_at: body.ends_at ?? null,
      status: body.status,
      discord_url: body.discord_url ?? null,
      banner_url: body.banner_url ?? null,
      public_visible: body.public_visible ?? 1,
      created_by: user.userId,
    });

    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'events.create', targetType: 'event', targetId: String(created.id),
      newValue: created, success: true, ipAddress: req.ip,
    });

    res.json({ success: true, data: created });
  } catch (err) {
    logger.error('[admin/events] create error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// PATCH /api/events/:id — update
eventsAdminRouter.patch('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.session.user!;
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const existing = getPublicEvent(id);
    if (!existing || existing.guild_id !== user.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof updatePublicEvent>[1] = { updated_by: user.userId };

    if (typeof body.title === 'string' && body.title.length > 0 && body.title.length <= 200) patch.title = body.title;
    if (typeof body.description === 'string') patch.description = body.description;
    if (body.description === null) patch.description = null;
    if (typeof body.event_type === 'string' && VALID_EVENT_TYPES.includes(body.event_type)) patch.event_type = body.event_type;
    if (typeof body.starts_at === 'number' && Number.isFinite(body.starts_at)) patch.starts_at = body.starts_at;
    if (typeof body.ends_at === 'number' && Number.isFinite(body.ends_at)) patch.ends_at = body.ends_at;
    if (body.ends_at === null) patch.ends_at = null;
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) patch.status = body.status;
    if (typeof body.discord_url === 'string') patch.discord_url = body.discord_url;
    if (body.discord_url === null) patch.discord_url = null;
    if (typeof body.banner_url === 'string') patch.banner_url = body.banner_url;
    if (body.banner_url === null) patch.banner_url = null;
    if (typeof body.public_visible === 'number') patch.public_visible = body.public_visible === 1 ? 1 : 0;

    const updated = updatePublicEvent(id, patch);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'events.update', targetType: 'event', targetId: String(id),
      oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[admin/events] update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// DELETE /api/events/:id
eventsAdminRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.session.user!;
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const existing = getPublicEvent(id);
    if (!existing || existing.guild_id !== user.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const ok = deletePublicEvent(id);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'events.delete', targetType: 'event', targetId: String(id),
      oldValue: existing, success: ok, ipAddress: req.ip,
    });
    res.json({ success: ok });
  } catch (err) {
    logger.error('[admin/events] delete error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
