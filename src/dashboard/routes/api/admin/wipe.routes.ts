// src/dashboard/routes/api/admin/wipe.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { getWipeInfo, upsertWipeInfo } from '../../../../db/index';
import { pushServerInfoToDiscord } from '../../../../services/discordSync';

export function wipeAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Moderator));

  const VALID_WIPE_TYPES = ['full', 'partial', 'economy', 'character'];

  // GET /api/wipe
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: getWipeInfo(guildId) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // PUT /api/wipe — upsert
  router.put('/', (req, res) => {
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
      pushServerInfoToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] server-info push failed (wipe):', err)
      );
    } catch (err) {
      logger.error('[admin/wipe] upsert error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
