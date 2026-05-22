// src/dashboard/routes/api/admin/faq.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requireContentEditor } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { parsePositiveIntParam } from '../../shared/request-validators';
import {
  listFaqItems, getFaqItem, createFaqItem, updateFaqItem, deleteFaqItem, reorderFaqItems,
} from '../../../../db/index';
import { pushFaqToDiscord } from '../../../../services/discordSync';

export function faqAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requireContentEditor);

  // GET /api/faq — list all (admin view, includes non-public)
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: listFaqItems(guildId) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // GET /api/faq/:id
  router.get('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const item = getFaqItem(id);
      if (!item || item.guild_id !== req.session.user!.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      res.json({ success: true, data: item });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/faq/reorder — must be before /:id
  router.post('/reorder', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as { category?: string; orderedIds?: number[] };
      if (!body.category || !Array.isArray(body.orderedIds)) {
        res.status(400).json({ success: false, error: 'Invalid input' });
        return;
      }
      reorderFaqItems(user.guildId, body.category, body.orderedIds.map(Number));
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'faq.reorder', targetType: 'faq.category', targetId: body.category,
        newValue: { orderedIds: body.orderedIds }, success: true, ipAddress: req.ip,
      });
      res.json({ success: true });
      pushFaqToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] faq push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/faq] reorder error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/faq — create
  router.post('/', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as {
        category?: string;
        question?: string;
        answer?: string;
        sort_order?: number;
        public_visible?: number;
      };

      if (!body.category || typeof body.category !== 'string' || body.category.length === 0 || body.category.length > 50) {
        res.status(400).json({ success: false, error: 'category required (1-50 chars)' });
        return;
      }
      if (!body.question || typeof body.question !== 'string' || body.question.length === 0 || body.question.length > 300) {
        res.status(400).json({ success: false, error: 'question required (1-300 chars)' });
        return;
      }
      if (!body.answer || typeof body.answer !== 'string' || body.answer.length === 0 || body.answer.length > 2000) {
        res.status(400).json({ success: false, error: 'answer required (1-2000 chars)' });
        return;
      }

      const created = createFaqItem({
        guild_id: user.guildId,
        category: body.category,
        question: body.question,
        answer: body.answer,
        sort_order: body.sort_order ?? 0,
        public_visible: body.public_visible ?? 1,
        created_by: user.userId,
      });

      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'faq.create', targetType: 'faq', targetId: String(created.id),
        newValue: created, success: true, ipAddress: req.ip,
      });

      res.json({ success: true, data: created });
      pushFaqToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] faq push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/faq] create error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // PATCH /api/faq/:id — update
  router.patch('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      const user = req.session.user!;
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getFaqItem(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const patch: Parameters<typeof updateFaqItem>[1] = { updated_by: user.userId };

      if (typeof body.category === 'string' && body.category.length > 0 && body.category.length <= 50) patch.category = body.category;
      if (typeof body.question === 'string' && body.question.length > 0 && body.question.length <= 300) patch.question = body.question;
      if (typeof body.answer === 'string' && body.answer.length > 0 && body.answer.length <= 2000) patch.answer = body.answer;
      if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;
      if (typeof body.public_visible === 'number') patch.public_visible = body.public_visible === 1 ? 1 : 0;

      const updated = updateFaqItem(id, patch);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'faq.update', targetType: 'faq', targetId: String(id),
        oldValue: existing, newValue: updated, success: true, ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
      pushFaqToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] faq push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/faq] update error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // DELETE /api/faq/:id
  router.delete('/:id', (req, res) => {
    try {
      const id = parsePositiveIntParam(req.params.id);
      const user = req.session.user!;
      if (!id) {
        res.status(400).json({ success: false, error: 'Invalid id' });
        return;
      }
      const existing = getFaqItem(id);
      if (!existing || existing.guild_id !== user.guildId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const ok = deleteFaqItem(id);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'faq.delete', targetType: 'faq', targetId: String(id),
        oldValue: existing, success: ok, ipAddress: req.ip,
      });
      res.json({ success: ok });
      pushFaqToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] faq push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/faq] delete error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
