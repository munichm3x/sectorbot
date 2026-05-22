// src/dashboard/routes/api/index.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { overviewRouter } from './overview.routes';
import { buildAnalyticsRouter } from './analytics.routes';
import { ticketsRouter } from './tickets.routes';
import { settingsRouter } from './settings.routes';
import { logsRouter } from './logs.routes';
import { membersRouter } from './members.routes';
import { serverStatusRouter } from './server-status.routes';
import { rulesAdminRouter } from './admin/rules.routes';
import { eventsAdminRouter } from './admin/events.routes';
import { changelogAdminRouter } from './admin/changelog.routes';
import { announcementsAdminRouter } from './admin/announcements.routes';
import { faqAdminRouter } from './admin/faq.routes';
import { wipeAdminRouter } from './admin/wipe.routes';
import { serverInfoAdminRouter } from './admin/server-info.routes';
import { botSettingsAdminRouter } from './admin/bot-settings.routes';
import { publicPreviewAdminRouter } from './admin/public-preview.routes';
import { systemAdminRouter } from './admin/system.routes';

export function buildApiRouter(client: Client): Router {
  const router = Router();

  router.get('/me', (req, res) => {
    const { userId, username, avatar, permLevel } = req.session.user!;
    res.json({ success: true, data: { userId, username, avatar, permLevel } });
  });

  router.use('/overview',       overviewRouter(client));
  router.use('/analytics',      buildAnalyticsRouter(client));
  router.use('/tickets',        ticketsRouter);
  router.use('/settings',       settingsRouter);
  router.use('/logs',           logsRouter);
  router.use('/members',        membersRouter(client));
  router.use('/server-status',  serverStatusRouter(client));
  router.use('/rules',          rulesAdminRouter(client));
  router.use('/events',         eventsAdminRouter(client));
  router.use('/changelog',      changelogAdminRouter(client));
  router.use('/announcements',  announcementsAdminRouter(client));
  router.use('/faq',            faqAdminRouter(client));
  router.use('/wipe',           wipeAdminRouter(client));
  router.use('/server-info',    serverInfoAdminRouter(client));
  router.use('/bot-settings',   botSettingsAdminRouter);
  router.use('/public-preview', publicPreviewAdminRouter(client));
  router.use('/system',         systemAdminRouter(client));

  return router;
}
