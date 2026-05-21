import { Router, type Request, type Response } from 'express';
import type { Client } from 'discord.js';
import { getMemberEventsByDay, getMessagesByChannel, getVoiceByChannel } from '../../../analytics/analytics.db';
import { getDb } from '../../../db';

export function publicCommunityRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        res.status(404).json({ success: false, error: 'Guild nicht gefunden.' });
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const since7d  = nowSec - 604_800;
      const since30d = nowSec - 2_592_000;

      const growth7  = getMemberEventsByDay(guildId, since7d);
      const growth30 = getMemberEventsByDay(guildId, since30d);

      const joins7  = growth7.reduce((a, r) => a + r.joins, 0);
      const joins30 = growth30.reduce((a, r) => a + r.joins, 0);

      const topMessages = getMessagesByChannel(guildId, since7d).slice(0, 5);
      const topVoice    = getVoiceByChannel(guildId, since7d).slice(0, 5);

      const db = getDb();
      const guildConfig = db
        .prepare('SELECT whitelist_role_id FROM guild_config WHERE guild_id = ?')
        .get(guildId) as { whitelist_role_id: string | null } | undefined;

      let verifiedCount: number | null = null;
      if (guildConfig?.whitelist_role_id) {
        const role = guild.roles.cache.get(guildConfig.whitelist_role_id);
        verifiedCount = role ? role.members.size : null;
      }

      res.json({
        success: true,
        data: {
          memberCount: guild.memberCount,
          verified: verifiedCount,
          growth: {
            joins7,
            joins30,
            byDay7: growth7.map(r => ({ ts: r.date_ts, joins: r.joins, leaves: r.leaves })),
          },
          topChannels: {
            messages: topMessages.map(c => ({
              channelId: c.channel_id,
              channelName: guild.channels.cache.get(c.channel_id)?.name ?? null,
              count: c.count,
            })),
            voice: topVoice.map(c => ({
              channelId: c.channel_id,
              channelName: guild.channels.cache.get(c.channel_id)?.name ?? null,
              seconds: c.total_seconds,
            })),
          },
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Community-Daten konnten nicht geladen werden.' });
    }
  });

  return router;
}
