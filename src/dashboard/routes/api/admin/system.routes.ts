import { Router } from 'express';
import type { Client } from 'discord.js';
import { existsSync, statSync } from 'fs';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { env } from '../../../../config/env';
import { runInitialImport } from '../../../../services/discordSync/import';
import { runDoctorChecks } from '../../../../commands/doctor';
import { getAllCategories, getConfig, getSupportRoles } from '../../../../services/guildConfigService';

// ENV variables to check for presence (NEVER return values)
const ENV_KEYS_TO_CHECK = [
  'DISCORD_TOKEN', 'CLIENT_ID', 'DATABASE_PATH', 'GROQ_API_KEY',
  'STEAM_API_KEY', 'DISCORD_CLIENT_SECRET', 'DISCORD_OAUTH_CALLBACK_URL',
  'DASHBOARD_SESSION_SECRET', 'DASHBOARD_PORT',
  'PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL',
];

async function resolveGuild(client: Client, guildId: string) {
  return client.guilds.cache.get(guildId) ?? client.guilds.fetch(guildId).catch(() => null);
}

async function resolveChannelSummary(guild: NonNullable<Awaited<ReturnType<typeof resolveGuild>>>, channelId: string | null) {
  if (!channelId) return { id: null, name: null, exists: false };
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return {
    id: channelId,
    name: channel?.name ?? null,
    exists: !!channel,
  };
}

async function resolveRoleSummary(guild: NonNullable<Awaited<ReturnType<typeof resolveGuild>>>, roleId: string | null) {
  if (!roleId) return { id: null, name: null, exists: false };
  const role = await guild.roles.fetch(roleId).catch(() => null);
  return {
    id: roleId,
    name: role?.name ?? null,
    exists: !!role,
  };
}

function buildSetupChecklist(config: ReturnType<typeof getConfig>, supportRoles: string[], categoriesCount: number) {
  const items = [
    { key: 'ticket_panel_channel', label: 'Ticket-Panel-Channel', done: !!config?.ticket_panel_channel_id, optional: false },
    { key: 'ticket_categories', label: 'Öffentliche Kategorien', done: categoriesCount > 0, optional: false },
    { key: 'support_roles', label: 'Support-Rollen', done: supportRoles.length > 0, optional: false },
    { key: 'ticket_log_channel', label: 'Log-Channel', done: !!config?.ticket_log_channel_id, optional: true },
    { key: 'rules_channel', label: 'Regelwerk-Channel', done: !!config?.rules_channel_id, optional: false },
    { key: 'whitelist_role', label: 'Whitelist-Rolle', done: !!config?.whitelist_role_id, optional: false },
    { key: 'ticket_panel_message', label: 'Ticket-Panel veröffentlicht', done: !!config?.ticket_panel_message_id, optional: false },
    { key: 'rules_message', label: 'Regelwerk veröffentlicht', done: !!config?.rules_message_id, optional: false },
  ];

  const required = items.filter(item => !item.optional);
  const completedRequired = required.filter(item => item.done).length;

  return {
    items,
    totals: {
      required: required.length,
      completedRequired,
      all: items.length,
      completedAll: items.filter(item => item.done).length,
    },
  };
}

export function systemAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Admin));

  // GET /api/system — bot info, uptime, ENV presence, missing-config warnings
  router.get('/', (_req, res) => {
    try {
      const uptimeSec = process.uptime();
      const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const nodeVer = process.version;
      const dbPath = env.DATABASE_PATH ?? './data/bot.db';
      let dbSize: number | null = null;
      try {
        if (existsSync(dbPath)) {
          dbSize = statSync(dbPath).size;
        }
      } catch { /* ignore */ }


    router.get('/doctor', async (req, res) => {
      try {
        const user = req.session.user!;
        const guild = await resolveGuild(client, user.guildId);
        if (!guild) {
          return res.status(404).json({ success: false, error: 'Guild nicht gefunden' });
        }

        const checks = await runDoctorChecks(guild);
        const summary = checks.reduce(
          (acc, check) => {
            acc.total += 1;
            acc[check.status] += 1;
            return acc;
          },
          { total: 0, ok: 0, warn: 0, error: 0 },
        );

        res.json({ success: true, data: { checks, summary } });
      } catch (err) {
        logger.error('[admin/system] doctor error:', err);
        res.status(500).json({ success: false, error: 'Diagnose konnte nicht geladen werden' });
      }
    });

    router.get('/config-summary', async (req, res) => {
      try {
        const user = req.session.user!;
        const guild = await resolveGuild(client, user.guildId);
        if (!guild) {
          return res.status(404).json({ success: false, error: 'Guild nicht gefunden' });
        }

        const config = getConfig(user.guildId);
        const supportRoleIds = getSupportRoles(user.guildId);
        const categories = getAllCategories(user.guildId);
        const enabledCategories = categories.filter(category => category.enabled === 1);
        const checklist = buildSetupChecklist(config, supportRoleIds, enabledCategories.length);

        const [ticketPanelChannel, ticketCategory, ticketLogChannel, rulesChannel, whitelistRole, supportRoles] = await Promise.all([
          resolveChannelSummary(guild, config?.ticket_panel_channel_id ?? null),
          resolveChannelSummary(guild, config?.ticket_category_id ?? null),
          resolveChannelSummary(guild, config?.ticket_log_channel_id ?? null),
          resolveChannelSummary(guild, config?.rules_channel_id ?? null),
          resolveRoleSummary(guild, config?.whitelist_role_id ?? null),
          Promise.all(supportRoleIds.map(async (roleId) => resolveRoleSummary(guild, roleId))),
        ]);

        res.json({
          success: true,
          data: {
            setupCompleted: config?.setup_completed === 1,
            updatedAt: config?.updated_at ?? null,
            checklist,
            channels: {
              ticketPanel: ticketPanelChannel,
              ticketCategory,
              ticketLog: ticketLogChannel,
              rules: rulesChannel,
            },
            roles: {
              whitelist: whitelistRole,
              support: supportRoles,
            },
            publication: {
              ticketPanelPublished: !!config?.ticket_panel_message_id,
              rulesPublished: !!config?.rules_message_id,
            },
            categories: {
              total: categories.length,
              enabled: enabledCategories.length,
              items: enabledCategories.map(category => ({
                key: category.key,
                label: category.label,
                emoji: category.emoji,
                description: category.description,
              })),
            },
          },
        });
      } catch (err) {
        logger.error('[admin/system] config-summary error:', err);
        res.status(500).json({ success: false, error: 'Konfigurationsübersicht konnte nicht geladen werden' });
      }
    });
      // ENV presence check — only key names, NEVER values
      const envPresence: Record<string, boolean> = {};
      for (const key of ENV_KEYS_TO_CHECK) {
        envPresence[key] = !!process.env[key];
      }

      // Missing-config warnings
      const warnings: string[] = [];
      if (!process.env.GROQ_API_KEY) warnings.push('GROQ_API_KEY fehlt — AI-Features deaktiviert.');
      if (!process.env.DISCORD_OAUTH_CALLBACK_URL) warnings.push('DISCORD_OAUTH_CALLBACK_URL fehlt — Admin-Login funktioniert nicht.');
      if (!process.env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL) warnings.push('PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL fehlt — Public-Login funktioniert nicht.');
      if (env.DASHBOARD_SESSION_SECRET === 'change-me-in-production') warnings.push('DASHBOARD_SESSION_SECRET ist Standardwert — bitte sichere Zufallsbytes setzen.');

      res.json({
        success: true,
        data: {
          bot: {
            online: client.ws.status === 0,
            uptimeSec: Math.round(uptimeSec),
            latencyMs: client.ws.ping >= 0 ? Math.round(client.ws.ping) : null,
            memoryMb,
            nodeVersion: nodeVer,
            botUserId: client.user?.id ?? null,
            botUsername: client.user?.username ?? null,
            guildCount: client.guilds.cache.size,
          },
          database: {
            path: dbPath,
            sizeBytes: dbSize,
          },
          env: envPresence,
          warnings,
        },
      });
    } catch (err) {
      logger.error('[admin/system] info error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/system/cache-clear — Owner only — clears Discord cache
  router.post('/cache-clear', requirePermission(PermLevel.Owner), (req, res) => {
    try {
      const user = req.session.user!;
      // Clear guild member cache (safe, will repopulate on demand)
      for (const guild of client.guilds.cache.values()) {
        guild.members.cache.clear();
      }
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'system.cache-clear', success: true, ipAddress: req.ip,
      });
      res.json({ success: true });
    } catch (err) {
      logger.error('[admin/system] cache-clear error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  // POST /api/system/resync-commands — Owner only — re-deploys slash commands
  // Stub for now: actual deploy logic lives in src/deploy.ts and requires CLI args.
  // We mark this as 501 to avoid accidental destructive actions until properly wired.
  router.post('/resync-commands', requirePermission(PermLevel.Owner), (_req, res) => {
    res.status(501).json({
      success: false,
      error: 'Command resync must be done via CLI (npm run deploy) for safety.',
    });
  });

  // POST /api/system/sync-import — Owner only — seeds DB from existing Discord content
  router.post('/sync-import', requirePermission(PermLevel.Owner), async (req, res) => {
    try {
      const user = req.session.user!;
      const report = await runInitialImport(client, user.guildId, `dashboard:${user.userId}`);
      insertAuditLog({
        guildId: user.guildId, adminUserId: user.userId,
        action: 'system.sync-import',
        newValue: { rules: report.rules.imported, changelog: report.changelog.imported, events: report.events.imported },
        success: report.errors.length === 0, ipAddress: req.ip,
      });
      res.json({ success: true, data: report });
    } catch (err) {
      logger.error('[admin/system] sync-import error:', err);
      res.status(500).json({ success: false, error: 'Import fehlgeschlagen' });
    }
  });

  return router;
}
