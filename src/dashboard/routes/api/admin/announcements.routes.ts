// src/dashboard/routes/api/admin/announcements.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requireContentEditor } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { parsePositiveIntParam } from '../../shared/request-validators';
import {
  listPublicAnnouncements, getPublicAnnouncement, createPublicAnnouncement,
  updatePublicAnnouncement, deletePublicAnnouncement,
} from '../../../../db/index';
import { pushAnnouncementToDiscord, deleteAnnouncementFromDiscord } from '../../../../services/discordSync';

export function announcementsAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requireContentEditor);

  const VALID_TYPES = ['info', 'maintenance', 'warning', 'event', 'whitelist', 'rules'];

  // GET /api/announcements — list all (admin view, includes non-public and inactive)
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: listPublicAnnouncements(guildId) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // GET /api/announcements/:id
  router.get('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const item = getPublicAnnouncement(id);
      if (!item || item.guild_id !== req.session.user!.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      res.json({ success: true, data: item });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/announcements — create
  router.post('/', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as {
        title?: string;
        body?: string;
        starts_at?: number;
        announcement_type?: string;
        priority?: number;
        ends_at?: number;
        show_as_banner?: number;
        active?: number;
        public_visible?: number;
      };

      if (!body.title || typeof body.title !== 'string' || body.title.length === 0 || body.title.length > 200) {
        res.status(400).json({ success: false, error: 'Title required (1-200 chars)' });
        return;
      }
      if (!body.body || typeof body.body !== 'string' || body.body.length === 0 || body.body.length > 2000) {
        res.status(400).json({ success: false, error: 'Body required (1-2000 chars)' });
        return;
      }
      if (typeof body.starts_at !== 'number' || !Number.isFinite(body.starts_at)) {
        res.status(400).json({ success: false, error: 'starts_at required (unix seconds)' });
        return;
      }
      if (body.announcement_type !== undefined && !VALID_TYPES.includes(body.announcement_type)) {
        res.status(400).json({ success: false, error: 'Invalid announcement_type' });
        return;
      }

      const created = createPublicAnnouncement({
        guild_id: user.guildId,
        title: body.title,
        body: body.body,
        starts_at: body.starts_at,
        announcement_type: body.announcement_type,
        priority: body.priority ?? 0,
        ends_at: body.ends_at ?? null,
        show_as_banner: body.show_as_banner ?? 0,
        active: body.active ?? 1,
        public_visible: body.public_visible ?? 1,
        created_by: user.userId,
      });

      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'announcements.create', targetType: 'announcement', targetId: String(created.id),
        newValue: created, success: true, ipAddress: req.ip,
      });

      res.json({ success: true, data: created });
      pushAnnouncementToDiscord(client, created.id).catch(err =>
        logger.error('[sync] announcement push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/announcements] create error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // PATCH /api/announcements/:id — update
  router.patch('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      const user = req.session.user!;
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getPublicAnnouncement(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const patch: Parameters<typeof updatePublicAnnouncement>[1] = { updated_by: user.userId };

      if (typeof body.title === 'string' && body.title.length > 0 && body.title.length <= 200) patch.title = body.title;
      if (typeof body.body === 'string' && body.body.length > 0 && body.body.length <= 2000) patch.body = body.body;
      if (typeof body.announcement_type === 'string' && VALID_TYPES.includes(body.announcement_type)) patch.announcement_type = body.announcement_type;
      if (typeof body.priority === 'number') patch.priority = body.priority;
      if (typeof body.starts_at === 'number' && Number.isFinite(body.starts_at)) patch.starts_at = body.starts_at;
      if (typeof body.ends_at === 'number' && Number.isFinite(body.ends_at)) patch.ends_at = body.ends_at;
      if (body.ends_at === null) patch.ends_at = null;
      if (typeof body.show_as_banner === 'number') patch.show_as_banner = body.show_as_banner === 1 ? 1 : 0;
      if (typeof body.active === 'number') patch.active = body.active === 1 ? 1 : 0;
      if (typeof body.public_visible === 'number') patch.public_visible = body.public_visible === 1 ? 1 : 0;

      const updated = updatePublicAnnouncement(id, patch);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'announcements.update', targetType: 'announcement', targetId: String(id),
        oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
      pushAnnouncementToDiscord(client, id).catch(err =>
        logger.error('[sync] announcement push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/announcements] update error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // DELETE /api/announcements/:id
  router.delete('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      const user = req.session.user!;
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getPublicAnnouncement(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      // Capture discord_message_id BEFORE deleting from DB
      const discordMessageId = (existing as { discord_message_id?: string | null }).discord_message_id;
      const ok = deletePublicAnnouncement(id);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'announcements.delete', targetType: 'announcement', targetId: String(id),
        oldValue: existing, success: ok, ipAddress: req.ip,
      });
      res.json({ success: ok });
      if (discordMessageId) {
        deleteAnnouncementFromDiscord(client, user.guildId, discordMessageId).catch(err =>
          logger.error('[sync] announcement delete from discord failed:', err)
        );
      }
    } catch (err) {
      logger.error('[admin/announcements] delete error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
