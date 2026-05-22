import { Router } from 'express';
import type { Client } from 'discord.js';
import { requirePermission, PermLevel } from '../../../auth/middleware';
import { logger } from '../../../../utils/logger';
import { getLatestServerStatus } from '../../../../analytics/analytics.db';
import {
  listRules, listPublicEvents, listChangelogEntries,
  listPublicAnnouncements, listFaqItems,
  getWipeInfo, getServerPublicInfo, getGuildConfig,
} from '../../../../db/index';

export function publicPreviewAdminRouter(client: Client): Router {
  const router = Router();
  router.use(requirePermission(PermLevel.Moderator));

  // GET /api/public-preview — status of every public section + counts
  router.get('/', (req, res) => {
    try {
      const guildId = req.session.user!.guildId;
      const guild = client.guilds.cache.get(guildId) ?? null;
      const status = getLatestServerStatus(guildId) ?? null;
      const guildConfig = getGuildConfig(guildId) ?? null;

      const rules = listRules(guildId);
      const rulesPublic = rules.filter(r => r.public_visible === 1).length;
      const events = listPublicEvents(guildId);
      const eventsPublic = events.filter(e => e.public_visible === 1 && (e.status === 'scheduled' || e.status === 'live')).length;
      const changelog = listChangelogEntries(guildId);
      const changelogPublic = changelog.filter(c => c.public_visible === 1 && c.status === 'published').length;
      const announcements = listPublicAnnouncements(guildId);
      const announcementsActive = announcements.filter(a => a.active === 1 && a.public_visible === 1).length;
      const faq = listFaqItems(guildId);
      const faqPublic = faq.filter(f => f.public_visible === 1).length;
      const wipe = getWipeInfo(guildId);
      const serverInfo = getServerPublicInfo(guildId);

      res.json({
        success: true,
        data: {
          publicUrl: '/public',  // relative path; frontend opens in new tab
          sections: {
            server: {
              hasData: !!status,
              statusOnline: status?.online === 1,
              warning: !status ? 'Noch kein Serverstatus aufgezeichnet.' : null,
            },
            community: {
              hasData: !!guild,
              memberCount: guild?.memberCount ?? null,
              warning: null,
            },
            rules: {
              total: rules.length,
              publicCount: rulesPublic,
              warning: rules.length === 0 ? 'Keine Regeln im Dashboard — Public zeigt Fallback-Inhalte.' : null,
            },
            events: {
              total: events.length,
              publicCount: eventsPublic,
              warning: eventsPublic === 0 ? 'Keine aktiven oder geplanten Events.' : null,
            },
            changelog: {
              total: changelog.length,
              publishedCount: changelogPublic,
              warning: changelogPublic === 0 ? 'Keine veröffentlichten Changelog-Einträge.' : null,
            },
            announcements: {
              total: announcements.length,
              activeCount: announcementsActive,
              warning: announcementsActive === 0 ? 'Keine aktiven Announcements.' : null,
            },
            faq: {
              total: faq.length,
              publicCount: faqPublic,
              warning: faqPublic === 0 ? 'FAQ ist leer — Public zeigt Empty State.' : null,
            },
            wipe: {
              configured: !!wipe,
              warning: !wipe ? 'Keine Wipe-Info hinterlegt.' : null,
            },
            serverInfo: {
              configured: !!serverInfo,
              warning: !serverInfo ? 'Keine öffentliche Server-Info hinterlegt (PvP, Teamgrößen, etc.).' : null,
            },
            rulesChannel: {
              configured: !!guildConfig?.rules_channel_id,
              warning: !guildConfig?.rules_channel_id ? 'Kein Regelwerk-Discord-Channel verlinkt.' : null,
            },
          },
        },
      });
    } catch (err) {
      logger.error('[admin/public-preview] error:', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
