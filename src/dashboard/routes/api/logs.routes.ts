// src/dashboard/routes/api/logs.routes.ts
import { Router } from 'express';
import { getLogBuffer } from '../../../utils/logger';
import { getAuditLogs } from '../../../analytics/analytics.db';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { parseLimitQuery, parseSearchQuery } from '../shared/request-validators';

export const logsRouter = Router();
logsRouter.use(requirePermission(PermLevel.Moderator));

logsRouter.get('/', (req, res) => {
  try {
    const levelRaw = req.query.level;
    const level = typeof levelRaw === 'string' ? levelRaw.toLowerCase() : '';
    const search = parseSearchQuery(req.query.search, 200);
    let entries  = getLogBuffer();
    if (level)  entries = entries.filter(e => e.level === level);
    if (search) entries = entries.filter(e => e.message.toLowerCase().includes(search.toLowerCase()));
    res.json({ success: true, data: entries.slice(-200).reverse() });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

logsRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const initial = getLogBuffer().slice(-50);
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  let lastLength = getLogBuffer().length;
  const interval = setInterval(() => {
    const buf     = getLogBuffer();
    const newOnes = buf.slice(lastLength);
    lastLength    = buf.length;
    if (newOnes.length > 0) res.write(`data: ${JSON.stringify(newOnes)}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

logsRouter.get('/audit', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const limit   = parseLimitQuery(req.query.limit, 50, 1, 200);
    res.json({ success: true, data: getAuditLogs(guildId, limit) });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
