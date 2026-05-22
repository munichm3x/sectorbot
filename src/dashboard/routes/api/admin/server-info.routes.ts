// src/dashboard/routes/api/admin/server-info.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { getServerPublicInfo, upsertServerPublicInfo } from '../../../../db/index';
import { pushServerInfoToDiscord } from '../../../../services/discordSync';

export function serverInfoAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Moderator));

  const VALID_GAME_MODES = ['PvP', 'PvE', 'Mixed'];

  function toBit(val: unknown): number | null {
    if (val === 1 || val === true || val === '1' || val === 'true') return 1;
    if (val === 0 || val === false || val === '0' || val === 'false') return 0;
    return null;
  }

  // GET /api/server-info
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: getServerPublicInfo(guildId) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // PUT /api/server-info — upsert
  router.put('/', (req, res) => {
    try {
      const user = req.session.user!;
      const body = req.body as {
        serverName?: string;
        description?: string;
        gameMode?: string;
        maxTeamSize?: number;
        soloColor?: string;
        lootRate?: string;
        safezones?: unknown;
        permadeath?: unknown;
        vehicleLimit?: string;
        baseLimit?: string;
        restartTimes?: string;
        mapRegion?: string;
        joinHint?: string;
        showHostInPublic?: unknown;
      };

      if (body.gameMode !== undefined && body.gameMode !== null && !VALID_GAME_MODES.includes(body.gameMode)) {
        res.status(400).json({ success: false, error: 'Invalid gameMode. Must be one of: PvP, PvE, Mixed' });
        return;
      }

      const safezonesVal = body.safezones !== undefined ? toBit(body.safezones) : undefined;
      const permaVal = body.permadeath !== undefined ? toBit(body.permadeath) : undefined;
      const showHostVal = body.showHostInPublic !== undefined ? toBit(body.showHostInPublic) : undefined;

      const updated = upsertServerPublicInfo({
        guildId: user.guildId,
        serverName: body.serverName ?? null,
        description: body.description ?? null,
        gameMode: body.gameMode ?? null,
        maxTeamSize: body.maxTeamSize ?? null,
        soloColor: body.soloColor ?? null,
        lootRate: body.lootRate ?? null,
        safezones: safezonesVal ?? null,
        permadeath: permaVal ?? null,
        vehicleLimit: body.vehicleLimit ?? null,
        baseLimit: body.baseLimit ?? null,
        restartTimes: body.restartTimes ?? null,
        mapRegion: body.mapRegion ?? null,
        joinHint: body.joinHint ?? null,
        showHostInPublic: showHostVal ?? 0,
        updatedBy: user.userId,
      });

      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'server-info.upsert', targetType: 'server_public_info', targetId: user.guildId,
        newValue: updated, success: true, ipAddress: req.ip,
      });

      res.json({ success: true, data: updated });
      pushServerInfoToDiscord(client, user.guildId).catch(err =>
        logger.error('[sync] server-info push failed:', err)
      );
    } catch (err) {
      logger.error('[admin/server-info] upsert error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
