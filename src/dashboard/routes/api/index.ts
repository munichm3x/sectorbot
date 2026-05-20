// src/dashboard/routes/api/index.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { overviewRouter } from './overview.routes';
import { analyticsRouter } from './analytics.routes';
import { ticketsRouter } from './tickets.routes';
import { settingsRouter } from './settings.routes';
import { logsRouter } from './logs.routes';
import { membersRouter } from './members.routes';
import { serverStatusRouter } from './server-status.routes';

export function buildApiRouter(client: Client): Router {
  const router = Router();

  router.get('/me', (req, res) => {
    const { userId, username, avatar, permLevel } = req.session.user!;
    res.json({ success: true, data: { userId, username, avatar, permLevel } });
  });

  router.use('/overview',      overviewRouter(client));
  router.use('/analytics',     analyticsRouter);
  router.use('/tickets',       ticketsRouter);
  router.use('/settings',      settingsRouter);
  router.use('/logs',          logsRouter);
  router.use('/members',       membersRouter(client));
  router.use('/server-status', serverStatusRouter(client));

  return router;
}
