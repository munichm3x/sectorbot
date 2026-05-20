// src/dashboard/routes/api/members.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { getDb } from '../../../db/index';

export function membersRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Moderator));

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const guild   = client.guilds.cache.get(guildId);
      if (!guild) { res.status(404).json({ success: false, error: 'Guild not found' }); return; }

      const members = guild.members.cache
        .filter(m => !m.user.bot)
        .map(m => ({
          id:          m.id,
          username:    m.user.username,
          globalName:  m.user.globalName,
          displayName: m.displayName,
          avatar:      m.user.displayAvatarURL({ size: 64 }),
          joinedAt:    m.joinedTimestamp,
          roles:       m.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        }));

      const ticketCounts = getDb().prepare(`SELECT opener_user_id, COUNT(*) AS count FROM tickets WHERE guild_id = ? GROUP BY opener_user_id`).all(guildId) as Array<{ opener_user_id: string; count: number }>;
      const ticketMap = new Map(ticketCounts.map(r => [r.opener_user_id, r.count]));
      const enriched = members.map(m => ({ ...m, ticketCount: ticketMap.get(m.id) ?? 0 }));

      res.json({ success: true, data: { members: enriched, total: enriched.length } });
    } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
  });

  return router;
}
