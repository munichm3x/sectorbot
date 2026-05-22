// src/dashboard/routes/api/analytics.routes.ts
import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  getMessagesByDay, getMessagesByChannel, getMessagesTotal,
  getVoiceByDay, getVoiceByChannel, getVoiceTotal, getStreamTotal,
  getMemberEventsByDay, getMemberJoinsTotal,
  getAiByDay, getAiByFeature, getAiTotal,
  getCommandUsage, getInteractionsTotal,
  getServerStatusHistory, getPeakPlayers,
  getMessageHeatmap, getVoiceHeatmap, getActivityByHour, getInteractionStats,
} from '../../../analytics/analytics.db';
import { getDb } from '../../../db/index';
import { logger } from '../../../utils/logger';
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

function cacheKey(kind: string, guildId: string, period: string, extra = ''): string {
  return `admin:${guildId}:${kind}:${period}:${extra}`;
}

function resolveChannelName(client: Client, guildId: string, channelId: string): string | null {
  const guild = client.guilds.cache.get(guildId);
  return guild?.channels.cache.get(channelId)?.name ?? null;
}

export function buildAnalyticsRouter(client: Client): Router {
  const analyticsRouter = Router();

  analyticsRouter.get('/messages', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('messages', guildId, period), 30_000, () => ({
        byDay: getMessagesByDay(guildId, since),
        byChannel: getMessagesByChannel(guildId, since).map(row => ({
          ...row,
          channelName: resolveChannelName(client, guildId, row.channel_id),
        })),
        total: getMessagesTotal(guildId, since),
        since,
      }));
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/voice', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('voice', guildId, period), 30_000, () => ({
        byDay: getVoiceByDay(guildId, since),
        byChannel: getVoiceByChannel(guildId, since).map(row => ({
          ...row,
          channelName: resolveChannelName(client, guildId, row.channel_id),
        })),
        totalSeconds: getVoiceTotal(guildId, since),
        totalStreamSeconds: getStreamTotal(guildId, since),
        since,
      }));
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/growth', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('growth', guildId, period), 30_000, () => ({
        byDay: getMemberEventsByDay(guildId, since),
        since,
      }));
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/ai', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('ai', guildId, period), 30_000, () => ({
        byFeature: getAiByFeature(guildId, since),
        byDay: getAiByDay(guildId, since),
        total: getAiTotal(guildId, since),
        since,
      }));
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/commands', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('commands', guildId, period), 30_000, () => ({
        commands: getCommandUsage(guildId, since),
        total: getInteractionsTotal(guildId, since),
        since,
      }));
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/server-status', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('server-status', guildId, period), 20_000, () => {
        const history = getServerStatusHistory(guildId, since, 500);
        const peak = getPeakPlayers(guildId, since);
        const total = history.length;
        const onlineCnt = history.filter(r => r.online === 1).length;
        const uptimePct = total > 0 ? Math.round((onlineCnt / total) * 100) : null;
        return { history, peak, uptimePct, since };
      });
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  analyticsRouter.get('/tickets', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const period  = String(req.query.period ?? '7d');
      const since   = parsePeriod(period);
      const data = readThroughAnalyticsCache(cacheKey('tickets', guildId, period), 30_000, () => {
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
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

// ─── Elite Analytics Endpoints ────────────────────────────────────────────────

// GET /api/analytics/heatmap?period=7d
  analyticsRouter.get('/heatmap', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey('heatmap', guildId, period), 30_000, () => ({
      messages: getMessageHeatmap(guildId, since),
      voice: getVoiceHeatmap(guildId, since),
    }));
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error('[analytics] heatmap error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
  });

// GET /api/analytics/hourly?period=24h|7d
  analyticsRouter.get('/hourly', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const period  = String(req.query.period ?? '24h');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey('hourly', guildId, period), 20_000, () => getActivityByHour(guildId, since));
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[analytics] hourly error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
  });

// GET /api/analytics/engagement?period=7d
  analyticsRouter.get('/engagement', (req, res) => {
  try {
    const guildId   = req.session.user!.guildId;
    const period    = String(req.query.period ?? '7d');
    const since     = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey('engagement', guildId, period), 20_000, () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const periodSec = nowSec - since;
      const prevSince = since - periodSec;

      const messages = getMessagesTotal(guildId, since);
      const voiceSecs = getVoiceTotal(guildId, since);
      const joins = getMemberJoinsTotal(guildId, since);
      const interactions = getInteractionsTotal(guildId, since);

      const prevMessages = getMessagesTotal(guildId, prevSince) - messages;
      const prevVoiceSecs = getVoiceTotal(guildId, prevSince) - voiceSecs;
      const prevJoins = getMemberJoinsTotal(guildId, prevSince) - joins;

      function score(value: number, scale: number): number {
        if (value <= 0) return 0;
        return Math.min(25, Math.round((Math.log10(value + 1) / Math.log10(scale + 1)) * 25));
      }

      function delta(curr: number, prev: number): { abs: number; pct: number | null } {
        const abs = curr - prev;
        const pct = prev > 0 ? Math.round((abs / prev) * 100) : null;
        return { abs, pct };
      }

      const msgScore = score(messages, 5000);
      const voiceScore = score(voiceSecs / 60, 6000);
      const joinScore = score(joins, 50);
      const cmdScore = score(interactions, 1000);

      return {
        score: msgScore + voiceScore + joinScore + cmdScore,
        breakdown: {
          messages: { value: messages, score: msgScore, max: 25, delta: delta(messages, prevMessages) },
          voice: { value: voiceSecs, score: voiceScore, max: 25, delta: delta(voiceSecs, prevVoiceSecs) },
          joins: { value: joins, score: joinScore, max: 25, delta: delta(joins, prevJoins) },
          commands: { value: interactions, score: cmdScore, max: 25, delta: delta(interactions, 0) },
        },
        period,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[analytics] engagement error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
  });

// GET /api/analytics/bot-health?period=7d
  analyticsRouter.get('/bot-health', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const period  = String(req.query.period ?? '7d');
    const since   = parsePeriod(period);
    const data = readThroughAnalyticsCache(cacheKey('bot-health', guildId, period), 20_000, () => {
      const stats = getInteractionStats(guildId, since);
      const aiStats = {
        total: getAiTotal(guildId, since),
        byFeature: getAiByFeature(guildId, since),
        byDay: getAiByDay(guildId, since),
      };
      return {
        interactions: stats,
        ai: aiStats,
        topCommands: getCommandUsage(guildId, since).slice(0, 10),
        botUptimeSec: Math.round(process.uptime()),
      };
    });
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error('[analytics] bot-health error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
  });

// GET /api/analytics/export?dataset=<name>&format=csv|json&period=7d
  analyticsRouter.get('/export', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const dataset = String(req.query.dataset ?? '');
    const format  = String(req.query.format ?? 'csv').toLowerCase();
    const since   = parsePeriod(req.query.period as string);

    let rows: Array<Record<string, unknown>> = [];
    let columns: string[] = [];

    switch (dataset) {
      case 'messages-by-day':
        columns = ['date_ts', 'date_iso', 'count'];
        rows = getMessagesByDay(guildId, since).map(r => ({
          date_ts: r.date_ts,
          date_iso: new Date(r.date_ts * 1000).toISOString().slice(0, 10),
          count: r.count,
        }));
        break;
      case 'voice-by-day':
        columns = ['date_ts', 'date_iso', 'total_seconds', 'session_count'];
        rows = getVoiceByDay(guildId, since).map(r => ({
          date_ts: r.date_ts,
          date_iso: new Date(r.date_ts * 1000).toISOString().slice(0, 10),
          total_seconds: r.total_seconds,
          session_count: r.session_count,
        }));
        break;
      case 'members-by-day':
        columns = ['date_ts', 'date_iso', 'joins', 'leaves', 'net'];
        rows = getMemberEventsByDay(guildId, since).map(r => ({
          date_ts: r.date_ts,
          date_iso: new Date(r.date_ts * 1000).toISOString().slice(0, 10),
          joins: r.joins,
          leaves: r.leaves,
          net: r.joins - r.leaves,
        }));
        break;
      case 'channels-text':
        columns = ['channel_id', 'channel_name', 'count'];
        rows = getMessagesByChannel(guildId, since).map(r => ({
          channel_id: r.channel_id,
          channel_name: resolveChannelName(client, guildId, r.channel_id),
          count: r.count,
        }));
        break;
      case 'channels-voice':
        columns = ['channel_id', 'channel_name', 'total_seconds', 'session_count'];
        rows = getVoiceByChannel(guildId, since).map(r => ({
          channel_id: r.channel_id,
          channel_name: resolveChannelName(client, guildId, r.channel_id),
          total_seconds: r.total_seconds,
          session_count: r.session_count,
        }));
        break;
      case 'server-status':
        columns = ['checked_at', 'iso', 'online', 'players_online', 'max_players', 'ping'];
        rows = getServerStatusHistory(guildId, since, 5000).map(r => ({
          checked_at: r.checked_at,
          iso: new Date(r.checked_at * 1000).toISOString(),
          online: r.online,
          players_online: r.players_online,
          max_players: r.max_players,
          ping: r.ping,
        }));
        break;
      case 'ai-by-feature':
        columns = ['feature', 'total', 'successes', 'errors', 'avg_duration_ms'];
        rows = getAiByFeature(guildId, since) as Array<Record<string, unknown>>;
        break;
      case 'command-usage':
        columns = ['command_name', 'total', 'successes', 'errors', 'avg_duration_ms'];
        rows = getCommandUsage(guildId, since) as Array<Record<string, unknown>>;
        break;
      default:
        res.status(400).json({ success: false, error: 'Unknown dataset' });
        return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="sectorbot-${dataset}-${dateStr}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(rows, null, 2));
      return;
    }

    // CSV
    const csv = [columns.join(',')];
    for (const r of rows) {
      csv.push(columns.map(c => escapeCsv(r[c])).join(','));
    }
    res.setHeader('Content-Disposition', `attachment; filename="sectorbot-${dataset}-${dateStr}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv.join('\n'));
  } catch (err) {
    logger.error('[analytics] export error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
  });

  return analyticsRouter;
}

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
