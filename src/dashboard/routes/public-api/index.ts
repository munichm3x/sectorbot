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
  buildRulesPayload,
  buildSupportPayload,
  buildWhitelistStatus,
  buildEventsPayload,
  buildChangelogPayload,
  buildAnnouncementsPayload,
  buildFaqPayload,
  discordMessageUrl,
} from './public-data';
import {
  getChangelogConfig,
  getGuildConfig,
  getTicketCategoryConfigs,
  listRules,
  listPublicEvents,
  listChangelogEntries,
  listPublicAnnouncements,
  listFaqItems,
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

  router.use('/server', publicServerRouter(client));
  router.use('/community', publicCommunityRouter(client));

  router.get('/rules', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      if (!guildId) {
        res.json({ success: true, data: buildRulesPayload(null, []) });
        return;
      }
      const config = getGuildConfig(guildId) ?? null;
      const dbRules = listRules(guildId, { publicOnly: true });
      res.json({ success: true, data: buildRulesPayload(config, dbRules) });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/events', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      const events = guildId ? listPublicEvents(guildId, { publicOnly: true }) : [];
      res.json({ success: true, data: { events: buildEventsPayload(events) } });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/announcements', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      const list = guildId ? listPublicAnnouncements(guildId, { activeOnly: true, publicOnly: true }) : [];
      const nowSec = Math.floor(Date.now() / 1000);
      const filtered = list.filter(a => a.starts_at <= nowSec && (a.ends_at == null || a.ends_at >= nowSec));
      res.json({ success: true, data: { announcements: buildAnnouncementsPayload(filtered) } });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/faq', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      const items = guildId ? listFaqItems(guildId, { publicOnly: true }) : [];
      res.json({ success: true, data: { faq: buildFaqPayload(items) } });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/changelog', (req, res) => {
    try {
      const guildId = resolveGuildId(req, client);
      const allEntries = guildId ? listChangelogEntries(guildId, { publicOnly: true }) : [];
      const entries = allEntries.filter(e => e.status === 'published');
      const config = guildId ? getChangelogConfig(guildId) : null;
      res.json({
        success: true,
        data: {
          changelog: buildChangelogPayload(entries),
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
