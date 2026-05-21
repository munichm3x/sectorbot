// src/dashboard/routes/public-api/overview.ts
// GET /public-api/overview
// Returns SCUM server status, guild info, and 24h activity aggregates.
// No bot internals (no latency, uptime, guild count).

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getLatestServerStatus,
  getMemberEventsByDay,
  getMessagesByChannel,
  getMessagesTotal,
  getStreamTotal,
  getVoiceTotal,
} from '../../../analytics/analytics.db';
import { buildEmptyContentPayload, sanitizeStatusHistory } from './public-data';

export function publicOverviewRouter(client: Client): Router {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const guildId  = req.session.publicUser?.guildId ?? client.guilds.cache.first()?.id;
      if (!guildId) {
        res.json({ success: true, data: { scumServer: null, guild: null, activity: null, announcements: [], events: [], changelog: [] } });
        return;
      }
      const since24h = Math.floor(Date.now() / 1000) - 86400;
      const since7d = Math.floor(Date.now() / 1000) - 7 * 86400;
      const since30d = Math.floor(Date.now() / 1000) - 30 * 86400;

      const guild = client.guilds.cache.get(guildId) ?? client.guilds.cache.first();

      const latestStatus = getLatestServerStatus(guildId);
      const scumServer = latestStatus ? sanitizeStatusHistory([latestStatus])[0] : null;

      const guildInfo = guild ? {
        name:        guild.name,
        memberCount: guild.memberCount,
      } : null;

      const growth = getMemberEventsByDay(guildId, since30d);
      const messagesToday = getMessagesTotal(guildId, since24h);
      const communityActivity =
        messagesToday >= 1500 ? 'Peak Activity' :
        messagesToday >= 500 ? 'Sehr aktiv' :
        messagesToday >= 100 ? 'Aktiv' :
        'Ruhig';
      const emptyContent = buildEmptyContentPayload();

      const activity = {
        messages:  messagesToday,
        voiceSecs: getVoiceTotal(guildId, since24h),
        streamSecs: getStreamTotal(guildId, since24h),
        activeTextChannels: getMessagesByChannel(guildId, since24h).length,
      };

      res.json({
        success: true,
        data: {
          scumServer,
          guild: guildInfo,
          community: {
            newMembers7d: growth.filter(r => r.date_ts >= since7d).reduce((sum, r) => sum + (r.joins ?? 0), 0),
            newMembers30d: growth.reduce((sum, r) => sum + (r.joins ?? 0), 0),
            status: communityActivity,
          },
          activity,
          announcements: emptyContent.announcements,
          events: emptyContent.events,
          changelog: emptyContent.changelog,
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
