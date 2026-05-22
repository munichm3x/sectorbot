import { Router, type Request, type Response } from 'express';
import type { Client } from 'discord.js';
import { getLatestServerStatus, getServerStatusHistory, getPeakPlayers } from '../../../analytics/analytics.db';
import { getDb, getWipeInfo, getServerPublicInfo } from '../../../db';
import { buildWipeInfoPayload, buildServerPublicInfoPayload, sanitizeStatusHistory } from './public-data';

const PERIODS: Record<string, number> = { '24h': 86_400, '7d': 604_800, '30d': 2_592_000 };

export function publicServerRouter(client: Client): Router {
  const router = Router();

  // GET /public-api/server
  router.get('/', (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser?.guildId ?? client.guilds.cache.first()?.id ?? null;
      if (!guildId) {
        res.json({
          success: true,
          data: {
            current: null,
            history: [],
            uptime24h: null,
            uptime7d: null,
            peak24h: 0,
            peak7d: 0,
            config: null,
            configCards: [],
            wipe: null,
            serverInfo: null,
            status: null,
            uptime: { hours24: null, days7: null },
            peak: { hours24: 0, days7: 0 },
          },
        });
        return;
      }
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
      const current = latest ? {
        online: !!latest.online,
        playersOnline: latest.players_online,
        maxPlayers: latest.max_players,
        ping: latest.ping,
        checkedAt: latest.checked_at,
      } : null;
      const history = sanitizeStatusHistory(history24);
      const publicConfig = config ? {
        enabled: !!config.enabled,
        host: config.host ? maskHost(config.host) : null,
        queryPort: config.query_port,
        updateIntervalSecs: config.update_interval_secs,
      } : null;

      res.json({
        success: true,
        data: {
          current,
          history,
          uptime24h: uptime24,
          uptime7d: uptime7,
          peak24h: peak24,
          peak7d: peak7,
          config: publicConfig,
          configCards: [
            { label: 'Serverstatus', value: publicConfig?.enabled ? 'Aktiv überwacht' : 'Nicht konfiguriert', state: publicConfig?.enabled ? 'online' : 'warning' },
            ...(publicConfig?.host ? [{ label: 'Host', value: publicConfig.host }] : []),
            ...(publicConfig?.queryPort != null ? [{ label: 'Query Port', value: String(publicConfig.queryPort) }] : []),
            ...(publicConfig?.updateIntervalSecs != null ? [{ label: 'Polling', value: `${publicConfig.updateIntervalSecs}s` }] : []),
          ],
          wipe: buildWipeInfoPayload(wipe),
          serverInfo: buildServerPublicInfoPayload(serverInfo),
          status: current ? {
            ...current,
            lastCheck: current.checkedAt,
          } : null,
          uptime: { hours24: uptime24, days7: uptime7 },
          peak: { hours24: peak24, days7: peak7 },
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Serverdaten konnten nicht geladen werden.' });
    }
  });

  // GET /public-api/server/history?period=24h|7d|30d
  router.get('/history', (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser?.guildId ?? client.guilds.cache.first()?.id ?? null;
      if (!guildId) {
        res.json({ success: true, data: [] });
        return;
      }
      const period = String(req.query.period ?? '24h');
      const secs = PERIODS[period] ?? 86_400;
      const since = Math.floor(Date.now() / 1000) - secs;
      const history = getServerStatusHistory(guildId, since, 1000);
      res.json({
        success: true,
        data: sanitizeStatusHistory(history).map(h => ({
          ts: h.checkedAt,
          checkedAt: h.checkedAt,
          online: h.online,
          players: h.playersOnline,
          playersOnline: h.playersOnline,
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
