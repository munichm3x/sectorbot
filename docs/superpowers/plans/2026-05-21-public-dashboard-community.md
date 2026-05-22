# Public Dashboard Community Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Transform the public dashboard from "Admin Light" into a real SCUM/Sektor-13 Community Hub with 7 sections (Übersicht, Server, Community, Regeln, Events, Changelog, Support) using real data where available and high-quality empty states + prepared API stubs everywhere else.

**Architecture:** Pure additive extension — admin dashboard untouched. Backend: extend `src/dashboard/routes/public-api/` with new modular routers per section. Frontend: new pages under `dashboard/public-user/js/pages/` + updated navigation in `index.html` and `app.js`. New CSS components (hero, accordion, timeline, announcement banner) added to `dashboard/public-user/css/dashboard.css` only — admin CSS untouched.

**Tech Stack:** TypeScript + Express + better-sqlite3 + vanilla JS SPA + Chart.js (existing stack — no new deps).

---

## Security Constraints (apply to EVERY task)

- Public API never exposes admin data, secrets, logs, audit, AI prompts, internal errors, or per-user analytics
- Tickets endpoints enforce ownership at SQL `WHERE` level (already done in existing tickets.ts)
- All user/API-derived data passed through `escapeHtml()` before `.innerHTML`
- Error responses use generic messages — no stacktraces
- No fake/hardcoded counts, players, events, changelogs — empty state if no data

---

## Data Source Inventory (decided based on analysis)

| Section | Data Source | Status |
|---------|-------------|--------|
| Server Status | `getLatestServerStatus`, `getServerStatusHistory`, `getPeakPlayers` | REAL |
| Community Activity | `getMessagesTotal`, `getVoiceTotal`, `getMemberEventsByDay`, `getMessagesByChannel`, `getVoiceByChannel` | REAL |
| Member counts | `client.guilds.cache.get(guildId).memberCount` | REAL |
| Whitelist-Rolle status | `member.roles.cache.has(whitelist_role_id)` | REAL |
| Discord Invite | `client.guilds.cache.get(guildId).vanityURLCode` or `guild_config` setting | REAL (if set) |
| Rules link | `guild_config.rules_channel_id` + `rules_message_id` → deep-link `discord.com/channels/{guild}/{channel}/{message}` | REAL |
| Events | `guild.scheduledEvents.fetch()` from discord.js | REAL (via Discord) |
| Changelog | `guild.channels.fetch(public_channel_id).messages.fetch({limit:10})` | REAL (via Discord) |
| Ticket categories | `ticket_category_config` table | REAL |
| Announcements | NO BACKEND — empty state + prepared API stub | EMPTY |
| FAQ | NO BACKEND — empty state + prepared static seed file | EMPTY |
| Server-Config (PvP/Wipe/Map) | NO BACKEND — empty state | EMPTY |
| Team-Verteilung | NO predefined teams — empty state + admin must configure first | EMPTY |

---

## Task F1: Backend — Public Server Detail API

**Files:**
- Create: `src/dashboard/routes/public-api/server.ts`
- Modify: `src/dashboard/routes/public-api/index.ts`

- [ ] **Step 1: Create server.ts router**

`src/dashboard/routes/public-api/server.ts`:
```typescript
import { Router, type Request, type Response } from 'express';
import type { Client } from 'discord.js';
import { getLatestServerStatus, getServerStatusHistory, getPeakPlayers } from '../../../analytics/analytics.db';
import { db } from '../../../db';

const PERIODS: Record<string, number> = { '24h': 86_400, '7d': 604_800, '30d': 2_592_000 };

export function publicServerRouter(client: Client): Router {
  const router = Router();

  // GET /public-api/server — server config + latest status + uptime/peak summary
  router.get('/', (req: Request, res: Response) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const config = db.prepare('SELECT host, query_port, enabled, update_interval_secs FROM scum_status_config WHERE guild_id = ?').get(guildId) as any;
      const latest = getLatestServerStatus(guildId);
      const since24h = Math.floor(Date.now() / 1000) - 86_400;
      const since7d  = Math.floor(Date.now() / 1000) - 604_800;
      const history24 = getServerStatusHistory(guildId, since24h);
      const history7d = getServerStatusHistory(guildId, since7d);
      const uptime24 = computeUptimePct(history24);
      const uptime7  = computeUptimePct(history7d);
      const peak24   = getPeakPlayers(guildId, since24h);
      const peak7    = getPeakPlayers(guildId, since7d);
      res.json({
        success: true,
        data: {
          status: latest ? {
            online: !!latest.online,
            playersOnline: latest.players_online,
            maxPlayers: latest.max_players,
            ping: latest.ping,
            lastCheck: latest.checked_at,
          } : null,
          config: config ? {
            enabled: !!config.enabled,
            host: config.host ? maskHost(config.host) : null,  // mask last octet for privacy
            queryPort: config.query_port,
            updateIntervalSecs: config.update_interval_secs,
          } : null,
          uptime: { hours24: uptime24, days7: uptime7 },
          peak: { hours24: peak24, days7: peak7 },
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Serverdaten konnten nicht geladen werden.' });
    }
  });

  // GET /public-api/server/history?period=24h|7d
  router.get('/history', (req, res) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const period = String(req.query.period ?? '24h');
      const secs = PERIODS[period] ?? 86_400;
      const since = Math.floor(Date.now() / 1000) - secs;
      const history = getServerStatusHistory(guildId, since, 1000);
      res.json({
        success: true,
        data: history.map(h => ({
          ts: h.checked_at,
          online: !!h.online,
          players: h.players_online,
          ping: h.ping,
        })),
      });
    } catch {
      res.status(500).json({ success: false, error: 'Verlauf konnte nicht geladen werden.' });
    }
  });

  return router;
}

function computeUptimePct(rows: any[]): number | null {
  if (!rows.length) return null;
  const online = rows.filter(r => r.online).length;
  return Math.round((online / rows.length) * 100);
}

function maskHost(host: string): string {
  // Don't reveal exact IP — show first 3 octets only if IPv4
  const parts = host.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return host;
}
```

- [ ] **Step 2: Wire into index.ts**

In `src/dashboard/routes/public-api/index.ts`, add:
```typescript
import { publicServerRouter } from './server';
// ... inside buildPublicApiRouter:
router.use('/server', publicServerRouter(client));
```

- [ ] **Step 3: Verify build**

Run `npx tsc --noEmit` — must be zero errors.

- [ ] **Step 4: Commit**

`feat(public-api): server detail + status history endpoints`

---

## Task F2: Backend — Public Community API

**Files:**
- Create: `src/dashboard/routes/public-api/community.ts`
- Modify: `src/dashboard/routes/public-api/index.ts`

- [ ] **Step 1: Create community.ts**

```typescript
import { Router } from 'express';
import type { Client } from 'discord.js';
import { getMemberEventsByDay, getMessagesByChannel, getVoiceByChannel } from '../../../analytics/analytics.db';

export function publicCommunityRouter(client: Client): Router {
  const router = Router();

  // GET /public-api/community — snapshot: member counts, growth, top channels
  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        res.status(404).json({ success: false, error: 'Guild nicht gefunden.' });
        return;
      }

      const since7d  = Math.floor(Date.now() / 1000) - 604_800;
      const since30d = Math.floor(Date.now() / 1000) - 2_592_000;

      const growth7  = getMemberEventsByDay(guildId, since7d);
      const growth30 = getMemberEventsByDay(guildId, since30d);

      const joins7  = growth7.reduce((a, r) => a + r.joins, 0);
      const joins30 = growth30.reduce((a, r) => a + r.joins, 0);

      // Top channels (aggregated, channel IDs only — frontend translates via guild.channels.cache if available)
      const topMessages = getMessagesByChannel(guildId, since7d).slice(0, 5);
      const topVoice    = getVoiceByChannel(guildId, since7d).slice(0, 5);

      // Whitelist role count (if configured)
      const guildConfig = (await import('../../../db')).db
        .prepare('SELECT whitelist_role_id FROM guild_config WHERE guild_id = ?')
        .get(guildId) as { whitelist_role_id: string | null } | undefined;

      let verifiedCount: number | null = null;
      if (guildConfig?.whitelist_role_id) {
        const role = guild.roles.cache.get(guildConfig.whitelist_role_id);
        verifiedCount = role ? role.members.size : null;
      }

      res.json({
        success: true,
        data: {
          memberCount: guild.memberCount,
          verified: verifiedCount,
          growth: {
            joins7,
            joins30,
            byDay7: growth7.map(r => ({ ts: r.date_ts, joins: r.joins, leaves: r.leaves })),
          },
          topChannels: {
            messages: topMessages.map(c => ({
              channelId: c.channel_id,
              channelName: guild.channels.cache.get(c.channel_id)?.name ?? null,
              count: c.count,
            })),
            voice: topVoice.map(c => ({
              channelId: c.channel_id,
              channelName: guild.channels.cache.get(c.channel_id)?.name ?? null,
              seconds: c.total_seconds,
            })),
          },
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Community-Daten konnten nicht geladen werden.' });
    }
  });

  return router;
}
```

- [ ] **Step 2: Wire into index.ts**

```typescript
import { publicCommunityRouter } from './community';
router.use('/community', publicCommunityRouter(client));
```

- [ ] **Step 3: Build + Commit**

`feat(public-api): community snapshot endpoint`

---

## Task F3: Backend — Events, Changelog, Rules, Announcements, FAQ

**Files:**
- Create: `src/dashboard/routes/public-api/events.ts`
- Create: `src/dashboard/routes/public-api/changelog.ts`
- Create: `src/dashboard/routes/public-api/rules.ts`
- Create: `src/dashboard/routes/public-api/announcements.ts`
- Create: `src/dashboard/routes/public-api/faq.ts`
- Modify: `src/dashboard/routes/public-api/index.ts`

- [ ] **Step 1: events.ts — read Discord Scheduled Events**

```typescript
import { Router } from 'express';
import type { Client, GuildScheduledEventStatus } from 'discord.js';

export function publicEventsRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) { res.status(404).json({ success: false, error: 'Guild nicht gefunden.' }); return; }

      const events = await guild.scheduledEvents.fetch();
      const data = events.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description ?? null,
        scheduledStart: e.scheduledStartTimestamp,
        scheduledEnd: e.scheduledEndTimestamp,
        status: e.status, // 1=SCHEDULED, 2=ACTIVE, 3=COMPLETED, 4=CANCELED
        location: e.entityMetadata?.location ?? null,
        channelName: e.channel?.name ?? null,
        userCount: e.userCount ?? null,
        coverImageURL: e.coverImageURL({ size: 512 }),
      })).sort((a, b) => (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0));

      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Events konnten nicht geladen werden.' });
    }
  });

  return router;
}
```

- [ ] **Step 2: changelog.ts — read recent Discord messages from public_channel_id**

```typescript
import { Router } from 'express';
import type { Client } from 'discord.js';
import { db } from '../../../db';

export function publicChangelogRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const cfg = db.prepare('SELECT public_channel_id FROM changelog_config WHERE guild_id = ?').get(guildId) as { public_channel_id: string | null } | undefined;
      if (!cfg?.public_channel_id) { res.json({ success: true, data: [] }); return; }
      const channel = await client.channels.fetch(cfg.public_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased() || !('messages' in channel)) {
        res.json({ success: true, data: [] }); return;
      }
      const msgs = await channel.messages.fetch({ limit: 10 });
      const data = Array.from(msgs.values())
        .filter(m => m.embeds.length > 0 || m.content.length > 0)
        .map(m => {
          const embed = m.embeds[0];
          return {
            id: m.id,
            title: embed?.title ?? (m.content.split('\n')[0] || 'Update'),
            body: embed?.description ?? m.content,
            timestamp: Math.floor(m.createdTimestamp / 1000),
            url: m.url,
            category: embed?.footer?.text ?? null,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, error: 'Changelog konnte nicht geladen werden.' });
    }
  });

  return router;
}
```

- [ ] **Step 3: rules.ts — return Discord rules deep-link + whitelist status**

```typescript
import { Router } from 'express';
import type { Client } from 'discord.js';
import { db } from '../../../db';

export function publicRulesRouter(client: Client): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const guildId = req.session.publicUser!.guildId;
      const userId  = req.session.publicUser!.userId;
      const cfg = db.prepare('SELECT rules_channel_id, rules_message_id, whitelist_role_id FROM guild_config WHERE guild_id = ?').get(guildId) as any;
      const guild = client.guilds.cache.get(guildId);
      let rulesLink: string | null = null;
      if (cfg?.rules_channel_id) {
        rulesLink = cfg.rules_message_id
          ? `https://discord.com/channels/${guildId}/${cfg.rules_channel_id}/${cfg.rules_message_id}`
          : `https://discord.com/channels/${guildId}/${cfg.rules_channel_id}`;
      }
      let whitelistStatus: 'verified' | 'pending' | 'not_configured' = 'not_configured';
      if (cfg?.whitelist_role_id && guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        whitelistStatus = member?.roles.cache.has(cfg.whitelist_role_id) ? 'verified' : 'pending';
      }
      res.json({
        success: true,
        data: {
          rulesLink,
          whitelistStatus,
          bannerURL: process.env.RULES_BANNER_URL ?? null,
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Regeln konnten nicht geladen werden.' });
    }
  });

  return router;
}
```

- [ ] **Step 4: announcements.ts — empty stub with prepared shape**

```typescript
import { Router } from 'express';

export function publicAnnouncementsRouter(): Router {
  const router = Router();

  // GET /public-api/announcements
  // Currently no backend system — returns empty array. Frontend shows empty state.
  // Schema is locked-in so future implementation can populate without breaking frontend.
  router.get('/', (_req, res) => {
    res.json({
      success: true,
      data: [] as Array<{
        id: string;
        type: 'maintenance' | 'event' | 'info' | 'warning' | 'whitelist';
        title: string;
        body: string;
        timestamp: number;
        active: boolean;
      }>,
    });
  });

  return router;
}
```

- [ ] **Step 5: faq.ts — static seed list (read-only, public-safe)**

```typescript
import { Router } from 'express';

const FAQ_SEED = [
  {
    category: 'Server',
    question: 'Wie joine ich dem SCUM Server?',
    answer: 'Verbinde dich über die Server-Browser-Funktion in SCUM. Die aktuelle Server-Adresse findest du im Discord unter dem Server-Status-Kanal.',
  },
  {
    category: 'Server',
    question: 'Wann sind Server-Restarts?',
    answer: 'Restart-Zeiten werden im Discord angekündigt. Schaue regelmäßig in den Updates-Kanal.',
  },
  {
    category: 'Whitelist',
    question: 'Wie funktioniert die Whitelist?',
    answer: 'Lies das Regelwerk im Discord und akzeptiere es per Button. Anschließend erhältst du automatisch die Whitelist-Rolle.',
  },
  {
    category: 'Regeln',
    question: 'Wo finde ich die Regeln?',
    answer: 'Im Discord-Server gibt es einen Regeln-Kanal. Über das Dashboard unter „Regeln" findest du einen Direkt-Link.',
  },
  {
    category: 'Support',
    question: 'Wie erstelle ich ein Support-Ticket?',
    answer: 'Im Discord gibt es einen Ticket-Kanal mit einem Auswahl-Menü. Wähle die passende Kategorie und beschreibe dein Anliegen.',
  },
  {
    category: 'Support',
    question: 'Wo sehe ich meine Tickets?',
    answer: 'Im Public Dashboard unter „Support" → „Meine Tickets". Du siehst nur deine eigenen Tickets, keine anderer User.',
  },
];

export function publicFaqRouter() {
  const router = (require('express').Router as () => any)();
  router.get('/', (_req: any, res: any) => {
    res.json({ success: true, data: FAQ_SEED });
  });
  return router;
}
```

(Type-safe version using imports if `require` is restricted — adjust style as needed.)

- [ ] **Step 6: Wire all into index.ts**

```typescript
import { publicEventsRouter } from './events';
import { publicChangelogRouter } from './changelog';
import { publicRulesRouter } from './rules';
import { publicAnnouncementsRouter } from './announcements';
import { publicFaqRouter } from './faq';
// ...
router.use('/events', publicEventsRouter(client));
router.use('/changelog', publicChangelogRouter(client));
router.use('/rules', publicRulesRouter(client));
router.use('/announcements', publicAnnouncementsRouter());
router.use('/faq', publicFaqRouter());
```

- [ ] **Step 7: Build + Commit**

`feat(public-api): events, changelog, rules, announcements, faq endpoints`

---

## Task F4: Frontend — Update api.js + Navigation + App Router

**Files:**
- Modify: `dashboard/public-user/js/api.js`
- Modify: `dashboard/public-user/index.html`
- Modify: `dashboard/public-user/js/app.js`

- [ ] **Step 1: Extend api.js with new endpoints**

Add to API object:
```javascript
server:         () => API.get('/server'),
serverHistory:  (p) => API.get(`/server/history?period=${p}`),
community:      () => API.get('/community'),
events:         () => API.get('/events'),
changelog:      () => API.get('/changelog'),
rules:          () => API.get('/rules'),
announcements:  () => API.get('/announcements'),
faq:            () => API.get('/faq'),
```

- [ ] **Step 2: Update index.html navigation**

Replace existing nav-items with new structure:
```html
<nav class="sidebar-nav" id="sidebar-nav">
  <div class="nav-section">Übersicht</div>
  <div class="nav-item" data-page="overview"><span class="nav-icon">◆</span> Übersicht</div>

  <div class="nav-section">Server</div>
  <div class="nav-item" data-page="server"><span class="nav-icon">●</span> Serverstatus</div>
  <div class="nav-item" data-page="community"><span class="nav-icon">◎</span> Community</div>

  <div class="nav-section">Information</div>
  <div class="nav-item" data-page="rules"><span class="nav-icon">⊙</span> Regeln</div>
  <div class="nav-item" data-page="events"><span class="nav-icon">▲</span> Events</div>
  <div class="nav-item" data-page="changelog"><span class="nav-icon">≡</span> Changelog</div>

  <div class="nav-section">Support</div>
  <div class="nav-item" data-page="support"><span class="nav-icon">⬡</span> Support &amp; FAQ</div>
</nav>
```

- [ ] **Step 3: Update app.js PAGE_TITLES**

```javascript
const PAGE_TITLES = {
  'overview':  'Übersicht',
  'server':    'Serverstatus',
  'community': 'Community',
  'rules':     'Regelwerk',
  'events':    'Events',
  'changelog': 'Updates & Changelog',
  'support':   'Support & FAQ',
};
```

Also rename the existing `tickets` page if still used — for backwards compat keep the file but route `tickets` → still works via direct hash navigation. Or simply remove from titles since we're consolidating into `support`.

- [ ] **Step 4: Commit**

`feat(public-dashboard): new navigation + api client extensions`

---

## Task F5: Frontend — CSS additions for Community Hub components

**Files:**
- Modify: `dashboard/public-user/css/dashboard.css` (append new classes; admin CSS untouched)

- [ ] **Step 1: Add new component classes at end of file**

```css
/* ── Hero Server Card ─────────────────────────────────────────────────────── */
.hero-card {
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-raised) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 1.75rem;
  margin-bottom: 1.5rem;
  position: relative;
  overflow: hidden;
}
.hero-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.6;
}
.hero-card.online::after,
.hero-card.offline::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 40% at 80% 0%, var(--accent-glow-sm), transparent 70%);
  pointer-events: none;
}
.hero-status-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.hero-status-name { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
.hero-status-meta { color: var(--text-secondary); font-size: 0.82rem; margin-top: 0.25rem; }
.hero-metrics {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}
.hero-metric { padding: 0.5rem 0; }
.hero-metric-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.4rem; }
.hero-metric-value { font-size: 1.75rem; font-weight: 800; font-family: var(--mono); line-height: 1; }
.hero-metric-value small { font-size: 0.85rem; font-weight: 400; color: var(--text-muted); }
.hero-metric.online .hero-metric-value { color: var(--online); }
.hero-metric.offline .hero-metric-value { color: var(--offline); }

/* ── Announcement Banner ─────────────────────────────────────────────────── */
.announcement-stack { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.announcement {
  display: flex; gap: 0.75rem; align-items: flex-start;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--info);
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.announcement.maintenance { border-left-color: var(--warning); background: rgba(232,152,26,0.04); }
.announcement.event       { border-left-color: var(--accent);  background: var(--accent-glow-sm); }
.announcement.warning     { border-left-color: var(--offline); background: rgba(224,82,82,0.04); }
.announcement.whitelist   { border-left-color: var(--online);  background: rgba(59,202,110,0.04); }
.announcement-icon { font-size: 1.1rem; line-height: 1; color: var(--text-secondary); flex-shrink: 0; }
.announcement-body { flex: 1; }
.announcement-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 0.15rem; }
.announcement-text  { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; }
.announcement-time  { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; margin-left: 1rem; }

/* ── Accordion (rules, faq) ──────────────────────────────────────────────── */
.accordion { display: flex; flex-direction: column; gap: 0.5rem; }
.accordion-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color var(--transition);
}
.accordion-item.open { border-color: var(--border-accent); }
.accordion-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.85rem 1.1rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.88rem; font-weight: 600;
  color: var(--text);
  transition: background var(--transition);
}
.accordion-header:hover { background: var(--surface-hover); }
.accordion-header .accordion-cat {
  display: inline-block;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--accent);
  margin-right: 0.6rem;
}
.accordion-chevron { font-family: var(--mono); color: var(--text-muted); transition: transform var(--transition); }
.accordion-item.open .accordion-chevron { transform: rotate(90deg); color: var(--accent); }
.accordion-body {
  padding: 0 1.1rem 1.1rem;
  font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;
  display: none;
}
.accordion-item.open .accordion-body { display: block; }
.accordion-body p + p { margin-top: 0.6rem; }

/* ── Timeline (changelog, events) ────────────────────────────────────────── */
.timeline { position: relative; padding-left: 1.5rem; }
.timeline::before {
  content: '';
  position: absolute; top: 0.5rem; bottom: 0.5rem; left: 0.4rem;
  width: 1px; background: var(--border);
}
.timeline-item { position: relative; padding-bottom: 1.25rem; }
.timeline-item:last-child { padding-bottom: 0; }
.timeline-item::before {
  content: '';
  position: absolute; left: -1.25rem; top: 0.35rem;
  width: 9px; height: 9px;
  background: var(--surface-raised);
  border: 2px solid var(--accent);
  border-radius: 50%;
}
.timeline-item.live::before { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-glow); }
.timeline-date { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); letter-spacing: 0.04em; margin-bottom: 0.25rem; }
.timeline-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.35rem; }
.timeline-body { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55; white-space: pre-wrap; }
.timeline-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.timeline-meta a { color: var(--accent); }

/* ── Event Card ──────────────────────────────────────────────────────────── */
.event-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.1rem;
  display: grid; grid-template-columns: auto 1fr auto; gap: 1rem;
  align-items: center;
}
.event-card.live { border-color: var(--accent); background: var(--accent-glow-sm); }
.event-date-block {
  text-align: center;
  padding: 0.5rem 0.75rem;
  background: var(--surface-raised);
  border-radius: var(--radius);
  min-width: 60px;
}
.event-date-day { font-size: 1.25rem; font-weight: 800; font-family: var(--mono); line-height: 1; }
.event-date-mon { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-top: 0.2rem; }
.event-info-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem; }
.event-info-meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.5rem; flex-wrap: wrap; }
.event-countdown { font-size: 0.78rem; color: var(--accent); font-weight: 600; white-space: nowrap; }

/* ── CTA Bar ─────────────────────────────────────────────────────────────── */
.cta-bar {
  display: flex; gap: 0.75rem; flex-wrap: wrap;
  padding: 1.1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
}
.cta-bar .btn { font-size: 0.82rem; padding: 0.55rem 1rem; }

/* ── Big Empty State ────────────────────────────────────────────────────── */
.empty-state-lg {
  text-align: center;
  padding: 4rem 1.5rem;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
}
.empty-state-lg .empty-icon { font-size: 2.5rem; opacity: 0.35; margin-bottom: 0.85rem; }
.empty-state-lg h3 { font-size: 1rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.4rem; }
.empty-state-lg p  { font-size: 0.85rem; max-width: 360px; margin: 0 auto; line-height: 1.5; }

/* ── Mobile responsive tweaks ───────────────────────────────────────────── */
@media (max-width: 640px) {
  .event-card { grid-template-columns: auto 1fr; }
  .event-countdown { grid-column: 1 / -1; text-align: right; }
  .hero-status-row { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 2: Commit**

`style(public-dashboard): add community hub component CSS`

---

## Task F6: Frontend — Overview page (Hero + Snapshot + Announcements + Next Event)

**Files:**
- Modify: `dashboard/public-user/js/pages/overview.js`

- [ ] **Step 1: Rewrite overview.js**

```javascript
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Sektor-13 Community Übersicht</h1>
        <p>Echtzeit-Status des SCUM-Servers und der Discord-Community.</p>
      </div>
      <div id="ov-announcements"></div>
      <div id="ov-hero"><div class="skeleton" style="height:160px;border-radius:12px"></div></div>
      <div id="ov-content"></div>
    `;

    try {
      const [ovRes, annRes, evRes, chRes] = await Promise.all([
        API.overview(),
        API.announcements().catch(() => ({ data: [] })),
        API.events().catch(() => ({ data: [] })),
        API.changelog().catch(() => ({ data: [] })),
      ]);
      const { scumServer, guild, activity } = ovRes.data;
      const announcements = annRes.data || [];
      const events = evRes.data || [];
      const changelog = chRes.data || [];

      // Announcements
      const annEl = document.getElementById('ov-announcements');
      if (announcements.length > 0) {
        annEl.innerHTML = `<div class="announcement-stack">${announcements.map(a => `
          <div class="announcement ${escapeHtml(a.type ?? 'info')}">
            <div class="announcement-icon">⬢</div>
            <div class="announcement-body">
              <div class="announcement-title">${escapeHtml(a.title)}</div>
              <div class="announcement-text">${escapeHtml(a.body)}</div>
            </div>
            <div class="announcement-time">${fmtDate(a.timestamp)}</div>
          </div>
        `).join('')}</div>`;
      }

      // Hero
      const online = scumServer?.online;
      document.getElementById('ov-hero').innerHTML = `
        <div class="hero-card ${online ? 'online' : 'offline'}">
          <div class="hero-status-row">
            <div>
              <div class="hero-status-name">SCUM Server</div>
              <div class="hero-status-meta">${online ? 'Server ist erreichbar und nimmt Spieler an' : scumServer ? 'Server ist offline oder nicht erreichbar' : 'Kein Serverstatus konfiguriert'}</div>
            </div>
            <span class="badge ${online ? 'badge-online' : 'badge-offline'}">${online ? '● Online' : '○ Offline'}</span>
          </div>
          ${scumServer ? `
            <div class="hero-metrics">
              <div class="hero-metric ${online ? 'online' : 'offline'}">
                <div class="hero-metric-label">Spieler</div>
                <div class="hero-metric-value">${escapeHtml(String(scumServer.playersOnline ?? 0))}<small>/${escapeHtml(String(scumServer.maxPlayers ?? '?'))}</small></div>
              </div>
              <div class="hero-metric">
                <div class="hero-metric-label">Ping</div>
                <div class="hero-metric-value">${escapeHtml(String(scumServer.ping ?? '—'))}<small>ms</small></div>
              </div>
              <div class="hero-metric">
                <div class="hero-metric-label">Letzter Check</div>
                <div class="hero-metric-value" style="font-size:0.95rem">${escapeHtml(fmtDate(scumServer.lastCheck))}</div>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      // Snapshot stat-grid + next event + changelog preview
      const upcomingEvent = events.find(e => e.status === 1 || e.status === 2);

      document.getElementById('ov-content').innerHTML = `
        <div class="section-header"><div class="section-title">Community Snapshot</div></div>
        <div class="stat-grid">
          <div class="stat-card accent">
            <div class="stat-label">Discord Mitglieder</div>
            <div class="stat-value">${guild ? escapeHtml(fmt(guild.memberCount)) : '—'}</div>
            <div class="stat-sub">${guild ? escapeHtml(guild.name) : ''}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Nachrichten 24h</div>
            <div class="stat-value">${escapeHtml(fmt(activity.messages))}</div>
            <div class="stat-sub">Discord-Aktivität</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Voice 24h</div>
            <div class="stat-value">${escapeHtml(fmt(Math.round((activity.voiceSecs ?? 0) / 60)))}<small style="font-size:0.85rem;font-weight:400"> min</small></div>
            <div class="stat-sub">Kumulierte Zeit</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top:1.5rem">
          <!-- Next Event -->
          <div>
            <div class="section-header"><div class="section-title">Nächstes Event</div><a href="#/events" style="font-size:0.78rem;color:var(--accent)">Alle Events →</a></div>
            ${upcomingEvent ? renderEventCard(upcomingEvent) : `
              <div class="empty-state-lg" style="padding:2rem 1rem">
                <div class="empty-icon">◌</div>
                <h3>Keine Events geplant</h3>
                <p>Sobald ein Event geplant wird, erscheint es hier.</p>
              </div>
            `}
          </div>
          <!-- Latest Update -->
          <div>
            <div class="section-header"><div class="section-title">Letzte Updates</div><a href="#/changelog" style="font-size:0.78rem;color:var(--accent)">Alle Updates →</a></div>
            ${changelog.length > 0 ? `
              <div class="timeline">${changelog.slice(0, 3).map(c => `
                <div class="timeline-item">
                  <div class="timeline-date">${escapeHtml(fmtDate(c.timestamp))}</div>
                  <div class="timeline-title">${escapeHtml(c.title)}</div>
                  ${c.body ? `<div class="timeline-body">${escapeHtml(c.body.slice(0, 200))}${c.body.length > 200 ? '…' : ''}</div>` : ''}
                </div>
              `).join('')}</div>
            ` : `
              <div class="empty-state-lg" style="padding:2rem 1rem">
                <div class="empty-icon">◌</div>
                <h3>Noch keine Updates</h3>
                <p>Updates und Changelogs erscheinen hier.</p>
              </div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      document.getElementById('ov-content').innerHTML = errorState('Übersicht konnte nicht geladen werden.');
    }
  },
};

function renderEventCard(e) {
  const start = e.scheduledStart ? new Date(e.scheduledStart) : null;
  const day = start ? String(start.getDate()).padStart(2, '0') : '—';
  const mon = start ? start.toLocaleString('de-DE', { month: 'short' }) : '';
  const live = e.status === 2;
  const countdown = start ? eventCountdown(start.getTime()) : '';
  return `
    <div class="event-card ${live ? 'live' : ''}">
      <div class="event-date-block">
        <div class="event-date-day">${escapeHtml(day)}</div>
        <div class="event-date-mon">${escapeHtml(mon)}</div>
      </div>
      <div>
        <div class="event-info-title">${escapeHtml(e.name)}</div>
        <div class="event-info-meta">
          ${start ? `<span>${escapeHtml(start.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }))} Uhr</span>` : ''}
          ${e.location ? `<span>· ${escapeHtml(e.location)}</span>` : ''}
        </div>
      </div>
      <div class="event-countdown">${live ? '● LIVE' : escapeHtml(countdown)}</div>
    </div>
  `;
}

function eventCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff < 0) return 'gerade beendet';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `in ${days}d ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `in ${hours}h ${mins}m`;
}
```

- [ ] **Step 2: Commit**

`feat(public-dashboard): overview hero + snapshot + next event + changelog preview`

---

## Task F7: Frontend — Server page

**Files:**
- Create: `dashboard/public-user/js/pages/server.js`

- [ ] **Step 1: Create server.js**

Page sections:
- Hero card (re-use pattern from overview) with full status
- Uptime + Peak stat-grid (24h + 7d)
- Status history chart (players over 24h) — Chart.js line chart
- Server-Config section: empty state with explanation (since no data exists)
- Season/Wipe section: empty state with explanation
- CTA bar: "Regeln lesen", "Support öffnen"

Use `API.server()` and `API.serverHistory(period)`. Empty states use `.empty-state-lg`. Mask shown IP (already done backend-side). All values `escapeHtml()`-wrapped.

Detailed code template:
```javascript
window['page-server'] = {
  period: '24h',
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>SCUM Serverstatus</h1>
        <p>Live-Status, Verlauf und Server-Information.</p>
      </div>
      <div id="srv-content"><div class="skeleton" style="height:300px"></div></div>
    `;
    await this.load();
  },
  async load() {
    try {
      const { data } = await API.server();
      const { status, config, uptime, peak } = data;
      const online = status?.online;
      document.getElementById('srv-content').innerHTML = `
        <!-- Hero -->
        <div class="hero-card ${online ? 'online' : 'offline'}">
          <div class="hero-status-row">
            <div>
              <div class="hero-status-name">SCUM Server</div>
              <div class="hero-status-meta">${config?.host ? 'Server-Adresse: ' + escapeHtml(config.host) + (config.queryPort ? ':' + escapeHtml(String(config.queryPort)) : '') : 'Adresse nicht öffentlich'}</div>
            </div>
            <span class="badge ${online ? 'badge-online' : 'badge-offline'}">${online ? '● Online' : '○ Offline'}</span>
          </div>
          ${status ? `
            <div class="hero-metrics">
              <div class="hero-metric ${online ? 'online' : 'offline'}">
                <div class="hero-metric-label">Spieler</div>
                <div class="hero-metric-value">${escapeHtml(String(status.playersOnline ?? 0))}<small>/${escapeHtml(String(status.maxPlayers ?? '?'))}</small></div>
              </div>
              <div class="hero-metric">
                <div class="hero-metric-label">Ping</div>
                <div class="hero-metric-value">${escapeHtml(String(status.ping ?? '—'))}<small>ms</small></div>
              </div>
              <div class="hero-metric">
                <div class="hero-metric-label">Letzter Check</div>
                <div class="hero-metric-value" style="font-size:0.95rem">${escapeHtml(fmtDate(status.lastCheck))}</div>
              </div>
            </div>
          ` : '<p style="color:var(--text-muted)">Noch kein Statuscheck durchgeführt.</p>'}
        </div>

        <!-- Stats: uptime + peak -->
        <div class="section-header"><div class="section-title">Verfügbarkeit & Peak</div></div>
        <div class="stat-grid">
          <div class="stat-card ${(uptime.hours24 ?? 0) >= 95 ? 'online' : 'warning'}">
            <div class="stat-label">Uptime 24h</div>
            <div class="stat-value">${uptime.hours24 != null ? escapeHtml(String(uptime.hours24)) + '%' : '—'}</div>
            <div class="stat-sub">letzte 24 Stunden</div>
          </div>
          <div class="stat-card ${(uptime.days7 ?? 0) >= 95 ? 'online' : 'warning'}">
            <div class="stat-label">Uptime 7d</div>
            <div class="stat-value">${uptime.days7 != null ? escapeHtml(String(uptime.days7)) + '%' : '—'}</div>
            <div class="stat-sub">letzte 7 Tage</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">Peak Spieler 24h</div>
            <div class="stat-value">${escapeHtml(String(peak.hours24 ?? '—'))}</div>
            <div class="stat-sub">Maximum letzte 24h</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">Peak Spieler 7d</div>
            <div class="stat-value">${escapeHtml(String(peak.days7 ?? '—'))}</div>
            <div class="stat-sub">Maximum letzte 7 Tage</div>
          </div>
        </div>

        <!-- History Chart -->
        <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Spielerzahl Verlauf (24h)</div></div>
        <div class="chart-card">
          <div style="height:240px"><canvas id="srv-history-chart"></canvas></div>
        </div>

        <!-- Server Config Empty State -->
        <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Server-Konfiguration</div></div>
        <div class="empty-state-lg">
          <div class="empty-icon">⊙</div>
          <h3>Konfigurations-Details folgen</h3>
          <p>PvP/PvE-Regeln, Teamgrößen, Restart-Zeiten und Wipe-Informationen werden hier angezeigt, sobald sie konfiguriert sind. Aktuelle Informationen findest du im Discord-Regelwerk.</p>
        </div>

        <!-- Season/Wipe Empty State -->
        <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Season & Wipe</div></div>
        <div class="empty-state-lg">
          <div class="empty-icon">◈</div>
          <h3>Keine Season-Informationen verfügbar</h3>
          <p>Aktuelle Season, letzter Wipe und nächster geplanter Wipe erscheinen hier, sobald ein Wipe-Plan im Server-Setup hinterlegt ist.</p>
        </div>

        <!-- CTA -->
        <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Aktionen</div></div>
        <div class="cta-bar">
          <a href="#/rules" class="btn btn-primary">Regelwerk lesen</a>
          <a href="#/support" class="btn btn-ghost">Support öffnen</a>
        </div>
      `;

      // Load history chart
      try {
        const { data: hist } = await API.serverHistory('24h');
        if (hist && hist.length > 0) {
          Charts.lineChart('srv-history-chart',
            hist.map(h => Charts.fmtHour ? Charts.fmtHour(h.ts) : new Date(h.ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' })),
            [{ label: 'Spieler online', data: hist.map(h => h.players ?? 0), borderColor: '#b5162f', backgroundColor: 'rgba(181,22,47,0.12)', tension: 0.3, fill: true }]);
        } else {
          document.getElementById('srv-history-chart').parentElement.innerHTML = emptyState('Noch keine Verlaufsdaten.');
        }
      } catch { /* chart fail is non-fatal */ }
    } catch (err) {
      document.getElementById('srv-content').innerHTML = errorState('Serverdaten konnten nicht geladen werden.');
    }
  },
};
```

- [ ] **Step 2: Commit**

`feat(public-dashboard): server detail page with hero, uptime, peak, history chart`

---

## Task F8: Frontend — Community page

**Files:**
- Create: `dashboard/public-user/js/pages/community.js`

- [ ] **Step 1: Create community.js**

Sections:
- Member-Stats (gesamt, neue 7d, neue 30d, verifiziert)
- Wachstums-Chart (joins/leaves byDay 7d)
- Top Text-Channels (aggregiert, count only)
- Top Voice-Channels (aggregiert, seconds only)
- Empty state for Team-Verteilung (since no predefined team roles)
- Empty state for Aktivitätszeiten / Heatmap (not yet aggregated)

Use `API.community()`. Charts via `Charts.barChart`. All values escaped.

- [ ] **Step 2: Commit**

`feat(public-dashboard): community page with growth, top channels, empty states`

---

## Task F9: Frontend — Rules page

**Files:**
- Create: `dashboard/public-user/js/pages/rules.js`

- [ ] **Step 1: Create rules.js**

Sections:
- Whitelist status card (verified / pending / not_configured)
- Rules accordion with hardcoded category list (Teams, Solo, PvP, Fahrzeuge, Base-Regeln, Permadeath, Whitelist, Discord, Support) — each with placeholder body and link to Discord
- Big CTA "Vollständiges Regelwerk im Discord lesen" (uses `data.rulesLink`)
- Banner image at top (`data.bannerURL` if set)

Important: Since rules content is not in DB, accordion shows generic category headers + Discord-link as primary CTA. No fake rules text. Each accordion item explains the topic briefly (1-2 sentences) and links to Discord for full text.

```javascript
window['page-rules'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Sektor-13 Regelwerk</h1>
        <p>Verbindliche Regeln für Server und Discord. Volltext im Discord.</p>
      </div>
      <div id="rules-content"><div class="skeleton" style="height:200px"></div></div>
    `;
    try {
      const { data } = await API.rules();
      const status = data.whitelistStatus;
      const statusBadge = status === 'verified'
        ? '<span class="badge badge-online">✓ Verifiziert</span>'
        : status === 'pending'
          ? '<span class="badge badge-warning">⧗ Whitelist offen</span>'
          : '<span class="badge badge-neutral">Nicht konfiguriert</span>';

      const categories = [
        { cat: 'TEAMS',      title: 'Teams & Gruppierungen', body: 'Maximale Teamgrößen, Farbcodes und Allianz-Regeln. Details im Discord-Regelwerk.' },
        { cat: 'SOLO',       title: 'Einzelkämpfer / Orange Solo', body: 'Schutz für echte Solo-Spieler und entsprechende Verhaltensregeln.' },
        { cat: 'PVP',        title: 'PvP-Regeln', body: 'Wann, wo und wie PvP erlaubt ist. Inkl. Sperrzeiten und Fair-Play-Grundsätzen.' },
        { cat: 'FAHRZEUGE',  title: 'Fahrzeuge & Limits', body: 'Maximale Anzahl Fahrzeuge pro Spieler/Team, erlaubte Fahrzeugtypen.' },
        { cat: 'BASE',       title: 'Base-Regeln', body: 'Build-Limits, Sperrzonen, Raid-Regeln und Schutz der Heimatbasis.' },
        { cat: 'PERMADEATH', title: 'Permadeath', body: 'Wie Permadeath funktioniert und welche Auswirkungen es auf Char und Inventar hat.' },
        { cat: 'WHITELIST',  title: 'Whitelist & Verifizierung', body: 'Wie du verifiziert wirst und Zugang zum Server bekommst.' },
        { cat: 'DISCORD',    title: 'Discord-Regeln', body: 'Verhaltensregeln im Discord-Server, inkl. Sprache, Werbung und Spam.' },
        { cat: 'SUPPORT',    title: 'Support & Tickets', body: 'Wann ein Ticket sinnvoll ist und wie du am schnellsten Hilfe bekommst.' },
      ];

      document.getElementById('rules-content').innerHTML = `
        ${data.bannerURL ? `<div style="margin-bottom:1.5rem;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)"><img src="${escapeHtml(data.bannerURL)}" alt="Sektor-13 Regelwerk" style="display:block;width:100%;height:auto"></div>` : ''}
        <div class="cta-bar">
          <div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:200px">
            <span style="font-size:0.85rem;color:var(--text-secondary)">Whitelist-Status:</span>
            ${statusBadge}
          </div>
          ${data.rulesLink ? `<a href="${escapeHtml(data.rulesLink)}" target="_blank" rel="noopener" class="btn btn-primary">Regelwerk im Discord öffnen ↗</a>` : ''}
        </div>
        <div class="section-header" style="margin-top:1rem"><div class="section-title">Themenübersicht</div></div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem">Klicke auf eine Kategorie für eine Kurzbeschreibung. Den vollständigen Regeltext findest du im Discord.</p>
        <div class="accordion">
          ${categories.map((c, i) => `
            <div class="accordion-item" data-idx="${i}">
              <div class="accordion-header">
                <div><span class="accordion-cat">${escapeHtml(c.cat)}</span>${escapeHtml(c.title)}</div>
                <span class="accordion-chevron">▸</span>
              </div>
              <div class="accordion-body">
                <p>${escapeHtml(c.body)}</p>
                ${data.rulesLink ? `<p><a href="${escapeHtml(data.rulesLink)}" target="_blank" rel="noopener">Volltext im Discord lesen →</a></p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Wire accordion clicks
      container.querySelectorAll('.accordion-header').forEach(h => {
        h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
      });
    } catch (err) {
      document.getElementById('rules-content').innerHTML = errorState('Regeln konnten nicht geladen werden.');
    }
  },
};
```

- [ ] **Step 2: Commit**

`feat(public-dashboard): rules page with whitelist status + categorized accordion`

---

## Task F10: Frontend — Events page

**Files:**
- Create: `dashboard/public-user/js/pages/events.js`

- [ ] **Step 1: Create events.js**

Sections:
- Live events (status === 2) — highlighted with live badge
- Upcoming events (status === 1)
- Past events (status === 3) — optionally collapsible
- Empty state if no events: `.empty-state-lg` with helpful message

Use `API.events()`. Render each as `.event-card` with date block + info + countdown. Live events get `.event-card.live` styling.

- [ ] **Step 2: Commit**

`feat(public-dashboard): events page with discord scheduled events`

---

## Task F11: Frontend — Changelog page

**Files:**
- Create: `dashboard/public-user/js/pages/changelog.js`

- [ ] **Step 1: Create changelog.js**

Sections:
- Filter buttons by category (Server, Discord, Regeln, Events, Bot) — based on `category` field from messages
- Timeline list of changelog entries (newest first)
- Each entry: date, title, body (with `white-space:pre-wrap`), optional Discord-link
- Empty state if no entries

Use `API.changelog()`. Each entry rendered via `.timeline-item`.

- [ ] **Step 2: Commit**

`feat(public-dashboard): changelog page with timeline view`

---

## Task F12: Frontend — Support page (Tickets + FAQ + Stats)

**Files:**
- Create: `dashboard/public-user/js/pages/support.js`
- Note: existing `dashboard/public-user/js/pages/tickets.js` remains accessible directly via `#/tickets` for compat — but Support page is the new primary route

- [ ] **Step 1: Create support.js**

Sections:
1. Top: Support stats (Mein offene Tickets, FAQ count, Ø Antwortzeit)
2. "Meine Tickets" — same UI as current tickets.js, embedded here
3. FAQ accordion — from `API.faq()`
4. CTA: "Ticket im Discord erstellen" link

Use `API.myTickets()`, `API.faq()`. Combine into one page with section dividers.

- [ ] **Step 2: Update PAGE_TITLES** in app.js (if not already done in F4) — add `'support': 'Support & FAQ'`

- [ ] **Step 3: Commit**

`feat(public-dashboard): support page with tickets + faq`

---

## Task F13: Build + Deploy + Final Verification

- [ ] **Step 1: TypeScript build**
```bash
cd "C:\Users\Administrator\Desktop\sectorbot" && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 2: PM2 restart**
```bash
pm2 restart scum-bot
```

- [ ] **Step 3: Smoke test**
- Visit `http://134.255.234.11:3000/public` — login as a public user
- Click each new nav item: Übersicht, Server, Community, Regeln, Events, Changelog, Support
- Verify each page renders without console errors
- Verify empty states display where data is missing
- Verify charts display where data exists
- Verify admin dashboard at `/` still works

- [ ] **Step 4: Commit final**
`feat(public-dashboard): community hub deployment`

---

## Definition of Done

- [ ] All 7 navigation sections work without errors
- [ ] No fake/hardcoded data anywhere
- [ ] Empty states are high-quality (icon + heading + 1-2 sentence explanation)
- [ ] Admin dashboard untouched and functional
- [ ] All API endpoints return correct shapes (no admin/secret leakage)
- [ ] All user-controlled / API-derived data passed through `escapeHtml()`
- [ ] TypeScript build: zero errors
- [ ] Mobile responsive: all pages usable on 375px width
- [ ] No console errors in browser
