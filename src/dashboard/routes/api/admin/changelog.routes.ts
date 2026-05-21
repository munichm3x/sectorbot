// src/dashboard/routes/api/admin/changelog.routes.ts
import { Router } from 'express';
import { requireContentEditor } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import {
  listChangelogEntries, getChangelogEntry, createChangelogEntry,
  updateChangelogEntry, deleteChangelogEntry, publishChangelog,
} from '../../../../db/index';

export const changelogAdminRouter = Router();
changelogAdminRouter.use(requireContentEditor);

const VALID_CATEGORIES = ['server', 'discord', 'rules', 'events', 'bot'];
const VALID_STATUSES = ['draft', 'published', 'archived'];

// GET /api/changelog — list all (admin view, includes non-public)
changelogAdminRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    res.json({ success: true, data: listChangelogEntries(guildId) });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// GET /api/changelog/:id
changelogAdminRouter.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const entry = getChangelogEntry(id);
    if (!entry || entry.guild_id !== req.session.user!.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: entry });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/changelog/:id/publish — special publish endpoint
changelogAdminRouter.post('/:id/publish', (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.session.user!;
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const existing = getChangelogEntry(id);
    if (!existing || existing.guild_id !== user.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const body = req.body as { discord_message_id?: string | null };
    const publishedAt = Math.floor(Date.now() / 1000);
    const discordMessageId = typeof body.discord_message_id === 'string' ? body.discord_message_id : null;
    const updated = publishChangelog(id, publishedAt, discordMessageId);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'changelog.publish', targetType: 'changelog', targetId: String(id),
      oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[admin/changelog] publish error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/changelog — create
changelogAdminRouter.post('/', (req, res) => {
  try {
    const user = req.session.user!;
    const body = req.body as {
      title?: string;
      body?: string;
      category?: string;
      version?: string;
      status?: string;
      public_visible?: number;
    };

    if (!body.title || typeof body.title !== 'string' || body.title.length === 0 || body.title.length > 200) {
      res.status(400).json({ success: false, error: 'Title required (1-200 chars)' });
      return;
    }
    if (!body.body || typeof body.body !== 'string' || body.body.length === 0 || body.body.length > 8000) {
      res.status(400).json({ success: false, error: 'Body required (1-8000 chars)' });
      return;
    }
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }
    if (body.version !== undefined && typeof body.version === 'string' && body.version.length > 50) {
      res.status(400).json({ success: false, error: 'version max 50 chars' });
      return;
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const created = createChangelogEntry({
      guild_id: user.guildId,
      title: body.title,
      body: body.body,
      category: body.category,
      version: body.version ?? null,
      status: body.status,
      public_visible: body.public_visible ?? 1,
      created_by: user.userId,
    });

    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'changelog.create', targetType: 'changelog', targetId: String(created.id),
      newValue: created, success: true, ipAddress: req.ip,
    });

    res.json({ success: true, data: created });
  } catch (err) {
    logger.error('[admin/changelog] create error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// PATCH /api/changelog/:id — update
changelogAdminRouter.patch('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.session.user!;
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const existing = getChangelogEntry(id);
    if (!existing || existing.guild_id !== user.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof updateChangelogEntry>[1] = { updated_by: user.userId };

    if (typeof body.title === 'string' && body.title.length > 0 && body.title.length <= 200) patch.title = body.title;
    if (typeof body.body === 'string' && body.body.length > 0 && body.body.length <= 8000) patch.body = body.body;
    if (typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category)) patch.category = body.category;
    if (typeof body.version === 'string' && body.version.length <= 50) patch.version = body.version;
    if (body.version === null) patch.version = null;
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) patch.status = body.status;
    if (typeof body.public_visible === 'number') patch.public_visible = body.public_visible === 1 ? 1 : 0;

    const updated = updateChangelogEntry(id, patch);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'changelog.update', targetType: 'changelog', targetId: String(id),
      oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[admin/changelog] update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// DELETE /api/changelog/:id
changelogAdminRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.session.user!;
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' });
      return;
    }
    const existing = getChangelogEntry(id);
    if (!existing || existing.guild_id !== user.guildId) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const ok = deleteChangelogEntry(id);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'changelog.delete', targetType: 'changelog', targetId: String(id),
      oldValue: existing, success: ok, ipAddress: req.ip,
    });
    res.json({ success: ok });
  } catch (err) {
    logger.error('[admin/changelog] delete error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
