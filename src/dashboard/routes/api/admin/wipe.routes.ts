// src/dashboard/routes/api/admin/wipe.routes.ts
import { Router } from 'express';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { getWipeInfo, upsertWipeInfo } from '../../../../db/index';

export const wipeAdminRouter = Router();
wipeAdminRouter.use(requirePermission(PermLevel.Moderator));

const VALID_WIPE_TYPES = ['full', 'partial', 'economy', 'character'];

// GET /api/wipe
wipeAdminRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    res.json({ success: true, data: getWipeInfo(guildId) });
  } catch {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// PUT /api/wipe — upsert
wipeAdminRouter.put('/', (req, res) => {
  try {
    const user = req.session.user!;
    const body = req.body as {
      currentSeason?: number;
      seasonName?: string;
      lastWipeAt?: number;
      lastWipeType?: string;
      nextWipeAt?: number;
      nextWipeType?: string;
      notes?: string;
      publicVisible?: number;
    };

    if (body.lastWipeType !== undefined && body.lastWipeType !== null && !VALID_WIPE_TYPES.includes(body.lastWipeType)) {
      res.status(400).json({ success: false, error: 'Invalid lastWipeType' });
      return;
    }
    if (body.nextWipeType !== undefined && body.nextWipeType !== null && !VALID_WIPE_TYPES.includes(body.nextWipeType)) {
      res.status(400).json({ success: false, error: 'Invalid nextWipeType' });
      return;
    }

    const updated = upsertWipeInfo({
      guildId: user.guildId,
      currentSeason: body.currentSeason ?? null,
      seasonName: body.seasonName ?? null,
      lastWipeAt: body.lastWipeAt ?? null,
      lastWipeType: body.lastWipeType ?? null,
      nextWipeAt: body.nextWipeAt ?? null,
      nextWipeType: body.nextWipeType ?? null,
      notes: body.notes ?? null,
      publicVisible: body.publicVisible ?? 1,
      updatedBy: user.userId,
    });

    insertAuditLog({
      guildId: user.guildId, adminUserId: user.userId,
      action: 'wipe.upsert', targetType: 'wipe_info', targetId: user.guildId,
      newValue: updated, success: true, ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[admin/wipe] upsert error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
