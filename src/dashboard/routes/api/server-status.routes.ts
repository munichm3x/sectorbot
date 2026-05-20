// src/dashboard/routes/api/server-status.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { getScumStatusConfig } from '../../../db/index';
import { queryServer } from '../../../features/scumStatus/scumStatus.service';
import { requirePermission, PermLevel } from '../../auth/middleware';

export function serverStatusRouter(_client: Client): Router {
  const router = Router();

  router.get('/', requirePermission(PermLevel.Admin), (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      res.json({ success: true, data: getScumStatusConfig(guildId) ?? null });
    } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
  });

  router.post('/test', requirePermission(PermLevel.Admin), async (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const config  = getScumStatusConfig(guildId);
      if (!config?.host || !config.query_port) {
        res.status(400).json({ success: false, error: 'Server not configured' });
        return;
      }
      const result = await queryServer(config.host, config.query_port);
      res.json({ success: true, data: result });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  return router;
}
