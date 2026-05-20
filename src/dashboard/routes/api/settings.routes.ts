// src/dashboard/routes/api/settings.routes.ts
import { Router } from 'express';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { logger } from '../../../utils/logger';
import { insertAuditLog } from '../../../analytics/analytics.db';
import {
  getGuildConfig, upsertGuildConfig, getGuildSupportRoles,
  getScumStatusConfig, upsertScumStatusConfig,
  getChangelogConfig,
} from '../../../db/index';

const MASK = '••••••••';

function maskField(value: string | null | undefined): string {
  if (!value) return '';
  return MASK;
}

export const settingsRouter = Router();
settingsRouter.use(requirePermission(PermLevel.Admin));

settingsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    res.json({
      success: true,
      data: {
        guild:       getGuildConfig(guildId)      ?? null,
        supportRoles: getGuildSupportRoles(guildId),
        scumStatus:  getScumStatusConfig(guildId) ?? null,
        changelog:   getChangelogConfig(guildId)  ?? null,
        streamer:    null,
      },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

settingsRouter.patch('/guild', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const body    = req.body as Record<string, unknown>;
    const allowed = ['ticket_panel_channel_id','ticket_category_id','ticket_log_channel_id','ticket_archive_channel_id','rules_channel_id','whitelist_role_id'];
    const patch: Record<string, string | null> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = typeof body[key] === 'string' ? body[key] as string : null;
    }
    const old = getGuildConfig(guildId);
    upsertGuildConfig(guildId, patch as Parameters<typeof upsertGuildConfig>[1]);
    insertAuditLog({ guildId, adminUserId: user.userId, action: 'settings.guild.update', oldValue: old, newValue: { ...old, ...patch }, success: true, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    logger.error('[dashboard] settings update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

settingsRouter.patch('/scum', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const body    = req.body as Record<string, unknown>;

    // Non-secret fields with type validation
    const patch: Record<string, unknown> = {};

    if ('channel_id' in body) {
      patch.channel_id = typeof body.channel_id === 'string' ? body.channel_id : null;
    }
    if ('host' in body) {
      patch.host = typeof body.host === 'string' ? body.host : null;
    }
    if ('query_port' in body) {
      const port = parseInt(String(body.query_port), 10);
      patch.query_port = isNaN(port) || port < 1 || port > 65535 ? null : port;
    }
    if ('update_interval_secs' in body) {
      const secs = parseInt(String(body.update_interval_secs), 10);
      patch.update_interval_secs = isNaN(secs) || secs < 1 ? null : secs;
    }
    if ('enabled' in body) {
      patch.enabled = body.enabled === true || body.enabled === 1 || body.enabled === 'true' ? 1 : 0;
    }

    const old = getScumStatusConfig(guildId);
    upsertScumStatusConfig(guildId, patch as Parameters<typeof upsertScumStatusConfig>[1]);
    insertAuditLog({ guildId, adminUserId: user.userId, action: 'settings.scum.update', oldValue: old, newValue: { ...old, ...patch }, success: true, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    logger.error('[dashboard] settings update error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});
