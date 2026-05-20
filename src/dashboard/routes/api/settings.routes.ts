// src/dashboard/routes/api/settings.routes.ts
import { Router } from 'express';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { insertAuditLog } from '../../../analytics/analytics.db';
import {
  getGuildConfig, upsertGuildConfig, getGuildSupportRoles,
  getScumStatusConfig, upsertScumStatusConfig,
  getChangelogConfig,
} from '../../../db/index';

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
  } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

settingsRouter.patch('/scum', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const user    = req.session.user!;
    const body    = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of ['channel_id','host','query_port','update_interval_secs','enabled']) {
      if (key in body) patch[key] = body[key];
    }
    const old = getScumStatusConfig(guildId);
    upsertScumStatusConfig(guildId, patch as Parameters<typeof upsertScumStatusConfig>[1]);
    insertAuditLog({ guildId, adminUserId: user.userId, action: 'settings.scum.update', oldValue: old, newValue: { ...old, ...patch }, success: true, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});
