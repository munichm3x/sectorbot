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
import { z } from 'zod';
import { DiscordSnowflake, NullableSnowflake, zodError } from '../shared/schemas';

const MASK = '••••••••';

function maskField(value: string | null | undefined): string {
  if (!value) return '';
  return MASK;
}

const GuildSettingsPatchSchema = z.object({
  ticket_panel_channel_id:   NullableSnowflake,
  ticket_category_id:        NullableSnowflake,
  ticket_log_channel_id:     NullableSnowflake,
  ticket_archive_channel_id: NullableSnowflake,
  rules_channel_id:          NullableSnowflake,
  whitelist_role_id:         NullableSnowflake,
}).strict();

const ScumSettingsPatchSchema = z.object({
  channel_id:           NullableSnowflake,
  host:                 z.string().max(253).nullable().optional(),
  query_port:           z.number().int().min(1).max(65535).nullable().optional(),
  update_interval_secs: z.number().int().min(5).max(3600).nullable().optional(),
  enabled:              z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
}).strict();

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
    const parsed  = GuildSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) { zodError(res, parsed.error); return; }
    const patch = parsed.data as Parameters<typeof upsertGuildConfig>[1];
    const old = getGuildConfig(guildId);
    upsertGuildConfig(guildId, patch);
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
    const parsed  = ScumSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) { zodError(res, parsed.error); return; }
    const { enabled, ...rest } = parsed.data;
    const patch: Record<string, unknown> = { ...rest };
    if (enabled !== undefined) {
      patch.enabled = (enabled === true || enabled === 1) ? 1 : 0;
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
