// src/dashboard/routes/public-api/overview.ts
// GET /public-api/overview
// Returns SCUM server status, guild info, and 24h activity aggregates.
// No bot internals (no latency, uptime, guild count).

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getLatestServerStatus,
  getMessagesTotal,
  getVoiceTotal,
} from '../../../analytics/analytics.db';

export function publicOverviewRouter(client: Client): Router {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const guildId  = req.session.publicUser!.guildId;
      const since24h = Math.floor(Date.now() / 1000) - 86400;

      const guild = client.guilds.cache.get(guildId) ?? client.guilds.cache.first();

      const latestStatus = getLatestServerStatus(guildId);
      const scumServer = latestStatus ? {
        online:        latestStatus.online === 1,
        playersOnline: latestStatus.players_online,
        maxPlayers:    latestStatus.max_players,
        ping:          latestStatus.ping,
        lastCheck:     latestStatus.checked_at,
      } : null;

      const guildInfo = guild ? {
        name:        guild.name,
        memberCount: guild.memberCount,
      } : null;

      const activity = {
        messages:  getMessagesTotal(guildId, since24h),
        voiceSecs: getVoiceTotal(guildId, since24h),
      };

      res.json({ success: true, data: { scumServer, guild: guildInfo, activity } });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
