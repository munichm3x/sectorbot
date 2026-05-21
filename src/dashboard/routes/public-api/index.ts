// src/dashboard/routes/public-api/index.ts
// Router for all /public-api/* endpoints.
// Public read routes are intentionally unauthenticated.
// Personal routes (/me, /tickets/*, /me/whitelist-status) require public auth.

import { Router } from 'express';
import type { Request } from 'express';
import type { Client } from 'discord.js';
import { requirePublicAuth } from '../../auth/public-middleware';
import { publicOverviewRouter } from './overview';
import { publicServerRouter } from './server';
import { publicCommunityRouter } from './community';
import { buildPublicAnalyticsRouter } from './analytics';
import { publicTicketsRouter } from './tickets';
import {
  buildEmptyContentPayload,
  buildRulesPayload,
  buildSupportPayload,
  buildWhitelistStatus,
  discordMessageUrl,
} from './public-data';
import {
  getChangelogConfig,
  getGuildConfig,
  getTicketCategoryConfigs,
} from '../../../db/index';

function resolveGuildId(req: Request, client: Client): string | null {
  return req.session.publicUser?.guildId ?? client.guilds.cache.first()?.id ?? null;
}

function publicGuild(client: Client, guildId: string | null) {
  if (!guildId) return null;
  return client.guilds.cache.get(guildId) ?? null;
}

export function buildPublicApiRouter(client: Client): Router {
  const router = Router();

  router.get('/me', requirePublicAuth, (req, res) => {
    const { userId, username, avatar, guildId } = req.session.publicUser!;
    res.json({ success: true, data: { userId, username, avatar, guildId } });
  });

  router.use('/server', requirePublicAuth, publicServerRouter(client));
  router.use('/community', requirePublicAuth, publicCommunityRouter(client));

  router.get('/rules', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      res.json({ success: true, data: buildRulesPayload(guildId ? getGuildConfig(guildId) ?? null : null) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/events', (_req, res) => {
    res.json({ success: true, data: { events: buildEmptyContentPayload().events } });
  });

  router.get('/announcements', (_req, res) => {
    res.json({ success: true, data: { announcements: buildEmptyContentPayload().announcements } });
  });

  router.get('/faq', (_req, res) => {
    res.json({ success: true, data: { faq: buildEmptyContentPayload().faq } });
  });

  router.get('/changelog', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      const config = guildId ? getChangelogConfig(guildId) : null;
      res.json({
        success: true,
        data: {
          changelog: buildEmptyContentPayload().changelog,
          discordUrl: guildId ? discordMessageUrl(guildId, config?.public_channel_id ?? null) : null,
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/support', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      res.json({
        success: true,
        data: guildId ? buildSupportPayload(getTicketCategoryConfigs(guildId)) : buildSupportPayload([]),
      });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/me/whitelist-status', requirePublicAuth, async (req, res) => {
    try {
      const { guildId, userId } = req.session.publicUser!;
      const guild = publicGuild(client, guildId);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      res.json({ success: true, data: buildWhitelistStatus(getGuildConfig(guildId) ?? null, member) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.use('/overview',  publicOverviewRouter(client));
  router.use('/analytics', buildPublicAnalyticsRouter(client));
  router.use('/tickets', requirePublicAuth, publicTicketsRouter);

  return router;
}
