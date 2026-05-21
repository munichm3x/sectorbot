import { Router, type Request, type Response } from 'express';
import type { Client } from 'discord.js';
import { getLatestServerStatus, getServerStatusHistory, getPeakPlayers } from '../../../analytics/analytics.db';
import { getDb, getWipeInfo, getServerPublicInfo } from '../../../db';
import { buildWipeInfoPayload, buildServerPublicInfoPayload } from './public-data';

const PERIODS: Record<string, number> = { '24h': 86_400, '7d': 604_800, '30d': 2_592_000 };

export function publicServerRouter(_client: Client): Router {
  const router = Router();

  // GET /public-api/server
  router.get('/', (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const db = getDb();
      const config = db.prepare(
        'SELECT host, query_port, enabled, update_interval_secs FROM scum_status_config WHERE guild_id = ?'
      ).get(guildId) as { host: string | null; query_port: number | null; enabled: number; update_interval_secs: number } | undefined;

      const latest = getLatestServerStatus(guildId);
      const nowSec = Math.floor(Date.now() / 1000);
      const since24h = nowSec - 86_400;
      const since7d  = nowSec - 604_800;
      const history24 = getServerStatusHistory(guildId, since24h);
      const history7d = getServerStatusHistory(guildId, since7d);
      const uptime24 = computeUptimePct(history24);
      const uptime7  = computeUptimePct(history7d);
      const peak24   = getPeakPlayers(guildId, since24h);
      const peak7    = getPeakPlayers(guildId, since7d);

      const wipe = getWipeInfo(guildId);
      const serverInfo = getServerPublicInfo(guildId);

      res.json({
        success: true,
        data: {
          status: latest ? {
            online: !!latest.online,
            playersOnline: latest.players_online,
            maxPlayers: latest.max_players,
            ping: latest.ping,
            lastCheck: latest.checked_at,
          } : null,
          config: config ? {
            enabled: !!config.enabled,
            host: config.host ? maskHost(config.host) : null,
            queryPort: config.query_port,
            updateIntervalSecs: config.update_interval_secs,
          } : null,
          uptime: { hours24: uptime24, days7: uptime7 },
          peak: { hours24: peak24, days7: peak7 },
          wipe: buildWipeInfoPayload(wipe),
          serverInfo: buildServerPublicInfoPayload(serverInfo),
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Serverdaten konnten nicht geladen werden.' });
    }
  });

  // GET /public-api/server/history?period=24h|7d|30d
  router.get('/history', (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const period = String(req.query.period ?? '24h');
      const secs = PERIODS[period] ?? 86_400;
      const since = Math.floor(Date.now() / 1000) - secs;
      const history = getServerStatusHistory(guildId, since, 1000);
      res.json({
        success: true,
        data: history.map(h => ({
          ts: h.checked_at,
          online: !!h.online,
          players: h.players_online,
          ping: h.ping,
        })),
      });
    } catch {
      res.status(500).json({ success: false, error: 'Verlauf konnte nicht geladen werden.' });
    }
  });

  return router;
}

function computeUptimePct(rows: Array<{ online: number | boolean }>): number | null {
  if (!rows.length) return null;
  const online = rows.filter(r => r.online).length;
  return Math.round((online / rows.length) * 100);
}

function maskHost(host: string): string {
  const parts = host.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return host;
}
