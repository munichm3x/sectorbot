// src/dashboard/routes/api/analytics.routes.ts
import { Router } from 'express';
import {
  getMessagesByDay, getMessagesByChannel, getMessagesTotal,
  getVoiceByDay, getVoiceByChannel, getVoiceTotal, getStreamTotal,
  getMemberEventsByDay,
  getAiByDay, getAiByFeature, getAiTotal,
  getCommandUsage, getInteractionsTotal,
  getServerStatusHistory, getPeakPlayers,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';

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

export const analyticsRouter = Router();

analyticsRouter.get('/messages', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getMessagesByDay(guildId, since), byChannel: getMessagesByChannel(guildId, since), total: getMessagesTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/voice', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getVoiceByDay(guildId, since), byChannel: getVoiceByChannel(guildId, since), totalSeconds: getVoiceTotal(guildId, since), totalStreamSeconds: getStreamTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/growth', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byDay: getMemberEventsByDay(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/ai', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { byFeature: getAiByFeature(guildId, since), byDay: getAiByDay(guildId, since), total: getAiTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/commands', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    res.json({ success: true, data: { commands: getCommandUsage(guildId, since), total: getInteractionsTotal(guildId, since), since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/server-status', (req, res) => {
  try {
    const guildId   = req.session.user!.guildId;
    const since     = parsePeriod(req.query.period as string);
    const history   = getServerStatusHistory(guildId, since, 500);
    const peak      = getPeakPlayers(guildId, since);
    const total     = history.length;
    const onlineCnt = history.filter(r => r.online === 1).length;
    const uptimePct = total > 0 ? Math.round((onlineCnt / total) * 100) : null;
    res.json({ success: true, data: { history, peak, uptimePct, since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

analyticsRouter.get('/tickets', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const since   = parsePeriod(req.query.period as string);
    const db      = getDb();
    const total   = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ?`).get(guildId) as { n: number }).n;
    const open    = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'open'`).get(guildId) as { n: number }).n;
    const closed  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;
    const byCategory = db.prepare(`SELECT category, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY category ORDER BY count DESC`).all(guildId, since) as Array<{ category: string; count: number }>;
    const byDay      = db.prepare(`SELECT (COALESCE(closed_at, created_at) / 86400) * 86400 AS date_ts, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND COALESCE(closed_at, created_at) >= ? GROUP BY date_ts ORDER BY date_ts`).all(guildId, since) as Array<{ date_ts: number; count: number }>;
    const avgRow     = db.prepare(`SELECT AVG(closed_at - created_at) AS avg_secs FROM tickets WHERE guild_id = ? AND status = 'closed' AND closed_at IS NOT NULL AND COALESCE(closed_at, created_at) >= ?`).get(guildId, since) as { avg_secs: number | null };
    res.json({ success: true, data: { total, open, closed, byCategory, byDay, avgResolutionSecs: avgRow.avg_secs, since } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
