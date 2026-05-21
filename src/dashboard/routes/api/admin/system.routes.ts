import { Router } from 'express';
import type { Client } from 'discord.js';
import { existsSync, statSync } from 'fs';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { insertAuditLog } from '../../../../analytics/analytics.db';
import { env } from '../../../../config/env';
import { runInitialImport } from '../../../../services/discordSync/import';

// ENV variables to check for presence (NEVER return values)
const ENV_KEYS_TO_CHECK = [
  'DISCORD_TOKEN', 'CLIENT_ID', 'DATABASE_PATH', 'GROQ_API_KEY',
  'STEAM_API_KEY', 'DISCORD_CLIENT_SECRET', 'DISCORD_OAUTH_CALLBACK_URL',
  'DASHBOARD_SESSION_SECRET', 'DASHBOARD_PORT',
  'PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL',
];

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
