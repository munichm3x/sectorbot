// src/dashboard/routes/api/overview.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getMessagesTotal, getVoiceTotal, getAiTotal,
  getMemberJoinsTotal, getLatestServerStatus,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';

export function overviewRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const guildId  = req.session.user!.guildId;
      const since24h = Math.floor(Date.now() / 1000) - 86400;
      const guild    = client.guilds.cache.get(guildId) ?? client.guilds.cache.first();

      const bot = {
        status:    'online',
        uptimeSec: Math.floor(process.uptime()),
        latencyMs: client.ws.ping,
        guilds:    client.guilds.cache.size,
        tag:       client.user?.tag ?? 'Unknown',
      };

      const latestStatus = getLatestServerStatus(guildId);
      const serverStatus = latestStatus ? {
        online:        latestStatus.online === 1,
        playersOnline: latestStatus.players_online,
        maxPlayers:    latestStatus.max_players,
        ping:          latestStatus.ping,
        lastCheck:     latestStatus.checked_at,
      } : null;

      const db = getDb();
      const openTickets  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId) as { n: number }).n;
      const closedToday  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, since24h) as { n: number }).n;
      const closedWeek   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, Math.floor(Date.now() / 1000) - 7 * 86400) as { n: number }).n;

      const activity = {
        messages:    getMessagesTotal(guildId, since24h),
        voiceSecs:   getVoiceTotal(guildId, since24h),
        aiRequests:  getAiTotal(guildId, since24h),
        memberJoins: getMemberJoinsTotal(guildId, since24h),
      };

      const guildInfo = guild ? {
        name:        guild.name,
        memberCount: guild.memberCount,
        icon:        guild.iconURL({ size: 64 }),
      } : null;

      res.json({ success: true, data: { bot, serverStatus, tickets: { open: openTickets, closedToday, closedWeek }, activity, guild: guildInfo } });
    } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
  });

  return router;
}
