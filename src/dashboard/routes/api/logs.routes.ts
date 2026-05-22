// src/dashboard/routes/api/logs.routes.ts
import { Router } from 'express';
import { getLogBuffer } from '../../../utils/logger';
import { getAuditLogs } from '../../../analytics/analytics.db';
import { requirePermission, PermLevel } from '../../auth/middleware';

export const logsRouter = Router();
logsRouter.use(requirePermission(PermLevel.Moderator));

logsRouter.get('/', (req, res) => {
  try {
    const level  = (req.query.level  as string) ?? '';
    const search = (req.query.search as string) ?? '';
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
    const limit   = Math.min(200, parseInt(req.query.limit as string) || 50);
    const rows    = getAuditLogs(guildId, limit);
    // Strip raw change payloads from the API response
    const safe = rows.map(({ old_value: _o, new_value: _n, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
