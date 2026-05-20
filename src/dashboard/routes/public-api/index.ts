// src/dashboard/routes/public-api/index.ts
// Router for all /public-api/* endpoints.
// All routes require requirePublicAuth — applied at router level.

import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePublicAuth } from '../../auth/public-middleware';
import { publicOverviewRouter } from './overview';
import { publicAnalyticsRouter } from './analytics';
import { publicTicketsRouter } from './tickets';

export function buildPublicApiRouter(client: Client): Router {
  const router = Router();

  // All public-api routes require public session
  router.use(requirePublicAuth);

  // GET /public-api/me
  router.get('/me', (req, res) => {
    const { userId, username, avatar, guildId } = req.session.publicUser!;
    res.json({ success: true, data: { userId, username, avatar, guildId } });
  });

  router.use('/overview',  publicOverviewRouter(client));
  router.use('/analytics', publicAnalyticsRouter);
  router.use('/tickets',   publicTicketsRouter);

  return router;
}
