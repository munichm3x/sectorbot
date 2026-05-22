import { Router } from 'express';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { listSettings, upsertSetting, deleteSetting } from '../../../../db/index';

const VALID_CATEGORIES = [
  'general', 'dashboard', 'server', 'ticket', 'role', 'channel',
  'ai', 'streamer', 'whitelist', 'moderation', 'design', 'security',
];

export const botSettingsAdminRouter = Router();
botSettingsAdminRouter.use(requirePermission(PermLevel.Admin));

// GET /api/bot-settings/:category — list settings for a category (secrets masked)
botSettingsAdminRouter.get('/:category', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const category = req.params.category;
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }
    const settings = listSettings(guildId, category); // secrets masked by default
    // Return as object: { key: { value, isSecret, updatedAt } } — easier for frontend
    const data: Record<string, { value: string | null; isSecret: boolean; updatedAt: number }> = {};
    for (const s of settings) {
      data[s.setting_key] = {
        value: s.setting_value,           // already masked to '***' if secret
        isSecret: s.is_secret === 1,
        updatedAt: s.updated_at,
      };
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[admin/bot-settings] list error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// PATCH /api/bot-settings — bulk upsert
// Body: { category: string, settings: [{ key, value, isSecret? }] }
botSettingsAdminRouter.patch('/', (req, res) => {
  try {
    const user = req.session.user!;
    const body = req.body as { category?: string; settings?: Array<{ key?: string; value?: unknown; isSecret?: boolean }> };
    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }
    if (!Array.isArray(body.settings) || body.settings.length === 0) {
      res.status(400).json({ success: false, error: 'No settings provided' });
      return;
    }

    const updated: string[] = [];
    const skippedMasked: string[] = [];
    for (const s of body.settings) {
      if (typeof s.key !== 'string' || s.key.length === 0 || s.key.length > 100) continue;
      const isSecret = s.isSecret === true;
      // Convert value to JSON string for storage — null is allowed (means "clear")
      let valueStr: string | null;
      if (s.value === null || s.value === undefined) {
        valueStr = null;
      } else if (typeof s.value === 'string') {
        valueStr = s.value;
      } else {
        valueStr = JSON.stringify(s.value);
      }
      // If client sent the mask '***' as value for a secret, that means "don't change" — skip
      if (isSecret && valueStr === '***') {
        skippedMasked.push(s.key);
        continue;
      }
      upsertSetting({
        guildId: user.guildId,
        category: body.category,
        key: s.key,
        value: valueStr,
        isSecret: isSecret ? 1 : 0,
        updatedBy: user.userId,
      });
      updated.push(s.key);
    }

    insertAuditLog({
      guildId: user.guildId,
      adminUserId: user.userId,
      action: `settings.${body.category}.update`,
      targetType: 'settings',
      targetId: body.category,
      newValue: { updated, skippedMasked }, // never log secret values themselves
      success: true,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { updated, skippedMasked } });
  } catch (err) {
    logger.error('[admin/bot-settings] update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// DELETE /api/bot-settings/:category/:key — remove a setting
botSettingsAdminRouter.delete('/:category/:key', (req, res) => {
  try {
    const user = req.session.user!;
    const category = req.params.category;
    const key = req.params.key;
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }
    const ok = deleteSetting(user.guildId, category, key);
    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: `settings.${category}.delete`,
      targetType: 'setting', targetId: `${category}/${key}`,
      success: ok, ipAddress: req.ip,
    });
    res.json({ success: ok });
  } catch (err) {
    logger.error('[admin/bot-settings] delete error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/bot-settings/test/:category/:key — test action (e.g. SCUM ping, AI prompt)
// For now: stub — returns 501 Not Implemented but accepts the call shape.
// Actual test logic will be wired in later tasks where each subsystem provides its tester.
botSettingsAdminRouter.post('/test/:category/:key', (_req, res) => {
  res.status(501).json({
    success: false,
    error: 'Test action not yet implemented for this category/key',
  });
});
