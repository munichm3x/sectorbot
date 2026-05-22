// src/dashboard/routes/public-api/analytics.ts
// Public analytics endpoints — same data as admin analytics, no per-user fields.
// Reuses existing analytics DB functions; no new queries needed.

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getMessagesByDay, getMessagesByChannel, getMessagesTotal,
  getVoiceByDay, getVoiceByChannel, getVoiceTotal, getStreamTotal,
  getMemberEventsByDay, getMemberJoinsTotal,
  getServerStatusHistory, getPeakPlayers,
  getMessageHeatmap, getVoiceHeatmap,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';
import { sanitizeStatusHistory } from './public-data';
import { readThroughAnalyticsCache } from '../shared/analytics-cache';

function parsePeriod(period?: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (!period)          return now - 7 * 86400;
  if (period === '24h') return now - 86400;
  if (period === '7d')  return now - 7  * 86400;
  if (period === '30d') return now - 30 * 86400;
  if (period === '90d') return now - 90 * 86400;
  if (period === 'all') return 0;
  const days = parseInt(period);
  if (!isNaN(days) && days > 0) return now - days * 86400;
  return now - 7 * 86400;
}

function resolveGuildId(req: { session: { publicUser?: { guildId: string } } }, client: Client): string | null {
  return req.session.publicUser?.guildId ?? client.guilds.cache.first()?.id ?? null;
}

export function buildPublicAnalyticsRouter(client: Client): Router {
const publicAnalyticsRouter = Router();

function cacheKey(guildId: string, kind: string, period: string): string {
  return `public:${guildId}:${kind}:${period}`;
}

publicAnalyticsRouter.get('/messages', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { byDay: [], byChannel: [], total: 0, since: 0 } }); return; }
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'messages', period), 30_000, () => ({ byDay: getMessagesByDay(guildId, since), byChannel: getMessagesByChannel(guildId, since), total: getMessagesTotal(guildId, since), since }));
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/voice', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { byDay: [], byChannel: [], totalSeconds: 0, totalStreamSeconds: 0, since: 0 } }); return; }
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'voice', period), 30_000, () => ({ byDay: getVoiceByDay(guildId, since), byChannel: getVoiceByChannel(guildId, since), totalSeconds: getVoiceTotal(guildId, since), totalStreamSeconds: getStreamTotal(guildId, since), since }));
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/growth', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { byDay: [], since: 0 } }); return; }
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'growth', period), 30_000, () => ({ byDay: getMemberEventsByDay(guildId, since), since }));
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/tickets', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { total: 0, open: 0, closed: 0, byCategory: [], byDay: [], avgResolutionSecs: null, since: 0 } }); return; }
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'tickets', period), 30_000, () => {
      const db = getDb();
      const total = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ?`).get(guildId) as { n: number }).n;
      const open = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId) as { n: number }).n;
      const closed = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;
      const byCategory = db.prepare(`SELECT category, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY category ORDER BY count DESC`).all(guildId, since) as Array<{ category: string; count: number }>;
      const byDay = db.prepare(`SELECT (COALESCE(closed_at, created_at) / 86400) * 86400 AS date_ts, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY date_ts ORDER BY date_ts`).all(guildId, since) as Array<{ date_ts: number; count: number }>;
      const avgRow = db.prepare(`SELECT AVG(closed_at - created_at) AS avg_secs FROM tickets WHERE guild_id = ? AND status = 'closed' AND closed_at IS NOT NULL AND COALESCE(closed_at, created_at) >= ?`).get(guildId, since) as { avg_secs: number | null };
      return { total, open, closed, byCategory, byDay, avgResolutionSecs: avgRow.avg_secs, since };
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

publicAnalyticsRouter.get('/server-status', (req, res) => {
  try {
    const guildId   = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { history: [], peak: 0, uptimePct: null, since: 0 } }); return; }
    const period    = String(req.query.period ?? '7d');
    const since     = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'server-status', period), 20_000, () => {
      const history = sanitizeStatusHistory(getServerStatusHistory(guildId, since, 500));
      const peak = getPeakPlayers(guildId, since);
      const total = history.length;
      const onlineCnt = history.filter(r => r.online).length;
      const uptimePct = total > 0 ? Math.round((onlineCnt / total) * 100) : null;
      return { history, peak, uptimePct, since };
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// GET /public-api/analytics/heatmap?period=7d — anonymized weekday×hour activity grid
publicAnalyticsRouter.get('/heatmap', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { messages: [], voice: [] } }); return; }
    const period = String(req.query.period ?? '7d');
    const since = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'heatmap', period), 30_000, () => ({
      messages: getMessageHeatmap(guildId, since),
      voice: getVoiceHeatmap(guildId, since),
    }));
    res.json({
      success: true,
      data,
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// GET /public-api/analytics/engagement?period=7d
publicAnalyticsRouter.get('/engagement', (req, res) => {
  try {
    const guildId = resolveGuildId(req, client);
    if (!guildId) { res.json({ success: true, data: { score: 0, breakdown: {}, period: req.query.period ?? '7d' } }); return; }
    const period    = String(req.query.period ?? '7d');
    const since     = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey(guildId, 'engagement', period), 20_000, () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const periodSec = nowSec - since;
      const prevSince = since - periodSec;

      const messages = getMessagesTotal(guildId, since);
      const voiceSecs = getVoiceTotal(guildId, since);
      const joins = getMemberJoinsTotal(guildId, since);

      const prevMessages = getMessagesTotal(guildId, prevSince) - messages;
      const prevVoiceSecs = getVoiceTotal(guildId, prevSince) - voiceSecs;
      const prevJoins = getMemberJoinsTotal(guildId, prevSince) - joins;

      function score(v: number, scale: number): number {
        if (v <= 0) return 0;
        return Math.min(25, Math.round((Math.log10(v + 1) / Math.log10(scale + 1)) * 25));
      }

      function delta(curr: number, prev: number): { abs: number; pct: number | null } {
        const abs = curr - prev;
        const pct = prev > 0 ? Math.round((abs / prev) * 100) : null;
        return { abs, pct };
      }

      const msgScore = score(messages, 5000);
      const voiceScore = score(voiceSecs / 60, 6000);
      const joinScore = score(joins, 50);
      return {
        score: Math.round(((msgScore + voiceScore + joinScore) / 75) * 100),
        breakdown: {
          messages: { value: messages, delta: delta(messages, prevMessages) },
          voice: { value: voiceSecs, delta: delta(voiceSecs, prevVoiceSecs) },
          joins: { value: joins, delta: delta(joins, prevJoins) },
        },
        period,
      };
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

return publicAnalyticsRouter;
}
