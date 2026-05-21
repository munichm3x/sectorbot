// src/dashboard/routes/api/admin/rules.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requireContentEditor } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import {
  listRules, getRule, createRule, updateRule, deleteRule, reorderRules,
} from '../../../../db/index';
import { pushRulesToDiscord } from '../../../../services/discordSync';

export function rulesAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requireContentEditor);

  const VALID_CATEGORIES = ['general', 'teams', 'solo', 'pvp', 'vehicles', 'bases', 'permadeath', 'whitelist', 'discord-support', 'events'];

  // GET /api/rules — list all (admin view, includes non-public)
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: listRules(guildId) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // GET /api/rules/:id
  router.get('/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const rule = getRule(id);
      if (!rule || rule.guild_id !== req.session.user!.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      res.json({ success: true, data: rule });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/rules/reorder — must be defined before /:id to avoid conflict
  router.post('/reorder', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as { category?: string; orderedIds?: number[] };
      if (!body.category || !Array.isArray(body.orderedIds)) {
        res.status(400).json({ success: false, error: 'Invalid input' });
        return;
      }
      reorderRules(user.guildId, body.category, body.orderedIds.map(Number));
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'rules.reorder', targetType: 'rule.category', targetId: body.category,
        newValue: { orderedIds: body.orderedIds }, success: true, ipAddress: req.ip,
      });
      res.json({ success: true });
      pushRulesToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] rules push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/rules] reorder error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/rules — create
  router.post('/', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as { category?: string; title?: string; body?: string; sort_order?: number; public_visible?: number };

      if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }
      if (!body.title || typeof body.title !== 'string' || body.title.length === 0 || body.title.length > 200) {
        res.status(400).json({ success: false, error: 'Title required (1-200 chars)' });
        return;
      }
      if (!body.body || typeof body.body !== 'string' || body.body.length === 0 || body.body.length > 4000) {
        res.status(400).json({ success: false, error: 'Body required (1-4000 chars)' });
        return;
      }

      const created = createRule({
        guild_id: user.guildId,
        category: body.category,
        title: body.title,
        body: body.body,
        sort_order: body.sort_order ?? 0,
        public_visible: body.public_visible ?? 1,
        created_by: user.userId,
      });

      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'rules.create', targetType: 'rule', targetId: String(created.id),
        newValue: created, success: true, ipAddress: req.ip,
      });

      res.json({ success: true, data: created });
      pushRulesToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] rules push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/rules] create error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // PATCH /api/rules/:id — update
  router.patch('/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.session.user!;
      if (!Number.isFinite(id)) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getRule(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = { updated_by: user.userId };
      if (typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category)) patch.category = body.category;
      if (typeof body.title === 'string' && body.title.length > 0 && body.title.length <= 200) patch.title = body.title;
      if (typeof body.body === 'string' && body.body.length > 0 && body.body.length <= 4000) patch.body = body.body;
      if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;
      if (typeof body.public_visible === 'number') patch.public_visible = body.public_visible === 1 ? 1 : 0;

      const updated = updateRule(id, patch as Parameters<typeof updateRule>[1]);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'rules.update', targetType: 'rule', targetId: String(id),
        oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
      pushRulesToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] rules push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/rules] update error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // DELETE /api/rules/:id
  router.delete('/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.session.user!;
      if (!Number.isFinite(id)) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getRule(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const ok = deleteRule(id);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'rules.delete', targetType: 'rule', targetId: String(id),
        oldValue: existing, success: ok, ipAddress: req.ip,
      });
      res.json({ success: ok });
      pushRulesToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] rules push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/rules] delete error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
