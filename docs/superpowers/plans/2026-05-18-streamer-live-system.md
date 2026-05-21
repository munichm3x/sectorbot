# Streamer Live Announcement System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein vollständiges Streamer-Live-Announcement-System mit einem einzigen `/streamer`-Slash-Command, interaktivem Dashboard, Twitch/YouTube-Integration und automatischem Live-Checker.

**Architecture:** Feature-Folder `src/features/streamer/` mit 8 fokussierten Dateien, analog zu `scumStatus/`. Alle Interaktionen unter Prefix `str`. Custom-IDs enthalten `guildId:userId` für Session-Sicherheit.

**Tech Stack:** Discord.js v14, better-sqlite3, Twitch Helix API, YouTube Data API v3, Node.js native `fetch`

---

## Dateien-Übersicht

**Neu erstellen:**
- `src/features/streamer/streamer.types.ts` — TypeScript-Interfaces
- `src/features/streamer/streamer.db.ts` — Alle DB-Queries
- `src/features/streamer/streamer.embeds.ts` — Alle EmbedBuilder
- `src/features/streamer/streamer.wizard.ts` — Wizard-State + Handler
- `src/features/streamer/streamer.dashboard.ts` — Dashboard + Untermenüs
- `src/features/streamer/streamer.checker.ts` — Live-Checker + Scheduler
- `src/features/streamer/streamer.twitch.ts` — Twitch Helix API
- `src/features/streamer/streamer.youtube.ts` — YouTube Data API
- `src/commands/streamer.ts` — `/streamer` Slash-Command

**Modifizieren:**
- `src/db/schema.ts` — 3 neue Tabellen
- `src/db/index.ts` — initDb + re-export
- `src/types/index.ts` — UserSelectMenuHandler Interface
- `src/client.ts` — userSelectHandlers Map + Routing
- `src/index.ts` — alle Handler registrieren
- `src/deploy.ts` — streamer command deployen

---

## Task 1: Foundation — Typen, Schema, DB, Client-Routing

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`
- Modify: `src/client.ts`
- Create: `src/features/streamer/streamer.types.ts`

- [ ] **Step 1: UserSelectMenuHandler zu types/index.ts hinzufügen**

Append nach dem `ModalHandler`-Interface in `src/types/index.ts`:

```typescript
import type {
  // ... existing imports ...
  UserSelectMenuInteraction,
} from 'discord.js';

export interface UserSelectMenuHandler {
  prefix: string;
  execute: (interaction: UserSelectMenuInteraction, payload: string) => Promise<unknown>;
}
```

Außerdem den Import-Block erweitern — `UserSelectMenuInteraction` zur bestehenden Import-Liste hinzufügen.

- [ ] **Step 2: 3 neue Tabellen in src/db/schema.ts anhängen**

```typescript
export const CREATE_STREAMER_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS streamer_config (
    guild_id                TEXT    PRIMARY KEY,
    enabled                 INTEGER NOT NULL DEFAULT 0,
    setup_completed         INTEGER NOT NULL DEFAULT 0,
    streamer_role_id        TEXT    NULL,
    live_channel_id         TEXT    NULL,
    check_interval_seconds  INTEGER NOT NULL DEFAULT 120,
    twitch_client_id        TEXT    NULL,
    twitch_client_secret    TEXT    NULL,
    youtube_api_key         TEXT    NULL,
    announcement_ping_type  TEXT    NOT NULL DEFAULT 'none',
    last_successful_check   TEXT    NULL,
    last_error              TEXT    NULL,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_STREAMERS_TABLE = `
  CREATE TABLE IF NOT EXISTS streamers (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id           TEXT    NOT NULL,
    discord_user_id    TEXT    NOT NULL,
    twitch_username    TEXT    NULL,
    youtube_channel_id TEXT    NULL,
    enabled            INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, discord_user_id)
  )
`;

export const CREATE_STREAM_LIVE_STATES_TABLE = `
  CREATE TABLE IF NOT EXISTS stream_live_states (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id                TEXT    NOT NULL,
    discord_user_id         TEXT    NOT NULL,
    platform                TEXT    NOT NULL,
    is_live                 INTEGER NOT NULL DEFAULT 0,
    last_stream_id          TEXT    NULL,
    last_live_url           TEXT    NULL,
    last_live_title         TEXT    NULL,
    announcement_message_id TEXT    NULL,
    last_checked_at         TEXT    NULL,
    last_announced_at       TEXT    NULL,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, discord_user_id, platform)
  )
`;
```

- [ ] **Step 3: initDb() in src/db/index.ts erweitern**

Import hinzufügen:
```typescript
import {
  // ... existing imports ...
  CREATE_STREAMER_CONFIG_TABLE,
  CREATE_STREAMERS_TABLE,
  CREATE_STREAM_LIVE_STATES_TABLE,
} from './schema';
```

In `initDb()` nach dem letzten `db.exec(...)`:
```typescript
  db.exec(CREATE_STREAMER_CONFIG_TABLE);
  db.exec(CREATE_STREAMERS_TABLE);
  db.exec(CREATE_STREAM_LIVE_STATES_TABLE);
```

- [ ] **Step 4: userSelectHandlers in src/client.ts einbauen**

Import erweitern:
```typescript
import type {
  Command, ButtonHandler, SelectMenuHandler,
  ChannelSelectMenuHandler, RoleSelectMenuHandler, ModalHandler,
  UserSelectMenuHandler,
} from './types';
```

Nach den anderen Maps:
```typescript
export const userSelectHandlers = new Map<string, UserSelectMenuHandler>();
```

Im `interactionCreate`-Handler nach dem `isRoleSelectMenu`-Block:
```typescript
    if (interaction.isUserSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = userSelectHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }
```

- [ ] **Step 5: streamer.types.ts erstellen**

```typescript
// src/features/streamer/streamer.types.ts

export interface StreamerConfig {
  guild_id:                string;
  enabled:                 number;
  setup_completed:         number;
  streamer_role_id:        string | null;
  live_channel_id:         string | null;
  check_interval_seconds:  number;
  twitch_client_id:        string | null;
  twitch_client_secret:    string | null;
  youtube_api_key:         string | null;
  announcement_ping_type:  'none' | 'role' | 'everyone' | 'here';
  last_successful_check:   string | null;
  last_error:              string | null;
  created_at:              string;
  updated_at:              string;
}

export interface Streamer {
  id:                 number;
  guild_id:           string;
  discord_user_id:    string;
  twitch_username:    string | null;
  youtube_channel_id: string | null;
  enabled:            number;
  created_at:         string;
  updated_at:         string;
}

export interface StreamLiveState {
  id:                      number;
  guild_id:                string;
  discord_user_id:         string;
  platform:                'twitch' | 'youtube';
  is_live:                 number;
  last_stream_id:          string | null;
  last_live_url:           string | null;
  last_live_title:         string | null;
  announcement_message_id: string | null;
  last_checked_at:         string | null;
  last_announced_at:       string | null;
  created_at:              string;
  updated_at:              string;
}

export interface LiveResult {
  isLive:       boolean;
  streamId?:    string;
  title?:       string;
  gameName?:    string;
  viewerCount?: number;
  thumbnailUrl?: string;
  startedAt?:   string;
  url?:         string;
  userName?:    string;
}

export type PingType = 'none' | 'role' | 'everyone' | 'here';

// Wizard-State (in-memory, 30-min TTL)
export interface WizardState {
  step:                    number;
  streamer_role_id?:       string;
  live_channel_id?:        string;
  twitch_client_id?:       string;
  twitch_client_secret?:   string;
  youtube_api_key?:        string | null;
  check_interval_seconds?: number;
  announcement_ping_type?: PingType;
  expiresAt:               number;
}
```

- [ ] **Step 6: TypeScript kompilieren — keine Fehler erwartet**

```bash
cd C:\Users\Administrator\Desktop\sectorbot
npm run build
```

Expected: Kompiliert ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/db/schema.ts src/db/index.ts src/client.ts src/features/streamer/streamer.types.ts
git commit -m "feat(streamer): foundation — types, schema, db tables, userSelect routing"
```

---

## Task 2: API Services — Twitch & YouTube

**Files:**
- Create: `src/features/streamer/streamer.twitch.ts`
- Create: `src/features/streamer/streamer.youtube.ts`

- [ ] **Step 1: streamer.twitch.ts erstellen**

```typescript
// src/features/streamer/streamer.twitch.ts
import { logger } from '../../utils/logger';
import type { LiveResult, StreamerConfig } from './streamer.types';

interface TokenCache {
  token:     string;
  expiresAt: number;
}

// Pro guild_id eigener Token-Cache (verschiedene Client-IDs möglich)
const tokenCache = new Map<string, TokenCache>();

async function getAppAccessToken(
  clientId: string,
  clientSecret: string,
  cacheKey: string,
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch Token-Fehler: HTTP ${res.status}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s Puffer
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt });
  return data.access_token;
}

export function clearTwitchTokenCache(guildId: string): void {
  tokenCache.delete(guildId);
}

export async function checkTwitchStream(
  config: StreamerConfig,
  username: string,
): Promise<LiveResult> {
  if (!config.twitch_client_id || !config.twitch_client_secret) {
    return { isLive: false };
  }

  try {
    const token = await getAppAccessToken(
      config.twitch_client_id,
      config.twitch_client_secret,
      config.guild_id,
    );

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          'Client-Id':     config.twitch_client_id,
          'Authorization': `Bearer ${token}`,
        },
      },
    );

    if (res.status === 401) {
      // Token ungültig — Cache leeren und einmal neu versuchen
      clearTwitchTokenCache(config.guild_id);
      return checkTwitchStream(config, username);
    }

    if (!res.ok) {
      throw new Error(`Twitch API HTTP ${res.status}`);
    }

    const data = await res.json() as {
      data: Array<{
        id: string;
        user_login: string;
        user_name: string;
        title: string;
        game_name: string;
        viewer_count: number;
        thumbnail_url: string;
        started_at: string;
      }>;
    };

    const stream = data.data[0];
    if (!stream) return { isLive: false };

    const thumbUrl = stream.thumbnail_url
      .replace('{width}', '1280')
      .replace('{height}', '720');

    return {
      isLive:       true,
      streamId:     stream.id,
      title:        stream.title,
      gameName:     stream.game_name,
      viewerCount:  stream.viewer_count,
      thumbnailUrl: thumbUrl,
      startedAt:    stream.started_at,
      url:          `https://twitch.tv/${stream.user_login}`,
      userName:     stream.user_name,
    };
  } catch (err) {
    // Secrets niemals loggen
    logger.warn(`[streamer] Twitch-Fehler für ${username}: ${err instanceof Error ? err.message : String(err)}`);
    return { isLive: false };
  }
}
```

- [ ] **Step 2: streamer.youtube.ts erstellen**

```typescript
// src/features/streamer/streamer.youtube.ts
import { logger } from '../../utils/logger';
import type { LiveResult } from './streamer.types';

export async function checkYouTubeStream(
  apiKey: string,
  channelId: string,
): Promise<LiveResult> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part',      'snippet');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('eventType', 'live');
    url.searchParams.set('type',      'video');
    url.searchParams.set('key',       apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error(`YouTube API HTTP ${res.status}`);
    }

    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { high?: { url: string } };
        };
      }>;
    };

    const item = data.items?.[0];
    if (!item) return { isLive: false };

    return {
      isLive:       true,
      streamId:     item.id.videoId,
      title:        item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high?.url,
      startedAt:    item.snippet.publishedAt,
      url:          `https://www.youtube.com/watch?v=${item.id.videoId}`,
      userName:     item.snippet.channelTitle,
    };
  } catch (err) {
    logger.warn(`[streamer] YouTube-Fehler für ${channelId}: ${err instanceof Error ? err.message : String(err)}`);
    return { isLive: false };
  }
}
```

- [ ] **Step 3: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/features/streamer/streamer.twitch.ts src/features/streamer/streamer.youtube.ts
git commit -m "feat(streamer): Twitch Helix + YouTube Data API services"
```

---

## Task 3: DB-Query-Layer

**Files:**
- Create: `src/features/streamer/streamer.db.ts`

- [ ] **Step 1: streamer.db.ts erstellen**

```typescript
// src/features/streamer/streamer.db.ts
import { getDb } from '../../db/index';
import type { StreamerConfig, Streamer, StreamLiveState, PingType } from './streamer.types';

// ── streamer_config ────────────────────────────────────────────────────────────

export function getStreamerConfig(guildId: string): StreamerConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM streamer_config WHERE guild_id = ?')
    .get(guildId) as StreamerConfig | undefined;
}

export function upsertStreamerConfig(
  guildId: string,
  data: Partial<Omit<StreamerConfig, 'guild_id' | 'created_at' | 'updated_at'>>,
): StreamerConfig {
  const db = getDb();
  db.prepare(`
    INSERT INTO streamer_config (guild_id, updated_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET updated_at = datetime('now')
  `).run(guildId);

  const fields = Object.entries(data)
    .map(([k]) => `${k} = @${k}`)
    .join(', ');

  if (fields) {
    db.prepare(`UPDATE streamer_config SET ${fields}, updated_at = datetime('now') WHERE guild_id = @guild_id`)
      .run({ guild_id: guildId, ...data });
  }

  return getStreamerConfig(guildId)!;
}

export function getAllActiveStreamerConfigs(): StreamerConfig[] {
  return getDb()
    .prepare(`SELECT * FROM streamer_config WHERE enabled = 1 AND setup_completed = 1`)
    .all() as StreamerConfig[];
}

export function setStreamerLastSuccessfulCheck(guildId: string): void {
  getDb()
    .prepare(`UPDATE streamer_config SET last_successful_check = datetime('now'), last_error = NULL WHERE guild_id = ?`)
    .run(guildId);
}

export function setStreamerLastError(guildId: string, error: string): void {
  getDb()
    .prepare(`UPDATE streamer_config SET last_error = ? WHERE guild_id = ?`)
    .run(error.slice(0, 500), guildId);
}

// ── streamers ──────────────────────────────────────────────────────────────────

export function getStreamer(guildId: string, discordUserId: string): Streamer | undefined {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? AND discord_user_id = ?')
    .get(guildId, discordUserId) as Streamer | undefined;
}

export function getEnabledStreamers(guildId: string): Streamer[] {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? AND enabled = 1')
    .all(guildId) as Streamer[];
}

export function getAllStreamers(guildId: string): Streamer[] {
  return getDb()
    .prepare('SELECT * FROM streamers WHERE guild_id = ? ORDER BY created_at ASC')
    .all(guildId) as Streamer[];
}

export function upsertStreamer(
  guildId: string,
  discordUserId: string,
  data: { twitch_username?: string | null; youtube_channel_id?: string | null },
): Streamer {
  const db = getDb();
  db.prepare(`
    INSERT INTO streamers (guild_id, discord_user_id, twitch_username, youtube_channel_id, enabled)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(guild_id, discord_user_id) DO UPDATE SET
      twitch_username    = COALESCE(@twitch_username, twitch_username),
      youtube_channel_id = COALESCE(@youtube_channel_id, youtube_channel_id),
      updated_at         = datetime('now')
  `).run({
    // positional for INSERT
    0: guildId, 1: discordUserId, 2: data.twitch_username ?? null, 3: data.youtube_channel_id ?? null,
    twitch_username:    data.twitch_username ?? null,
    youtube_channel_id: data.youtube_channel_id ?? null,
  });

  // Simpler approach:
  const existing = getStreamer(guildId, discordUserId);
  if (existing) {
    db.prepare(`
      UPDATE streamers SET
        twitch_username    = COALESCE(?, twitch_username),
        youtube_channel_id = COALESCE(?, youtube_channel_id),
        updated_at         = datetime('now')
      WHERE guild_id = ? AND discord_user_id = ?
    `).run(
      data.twitch_username    ?? null,
      data.youtube_channel_id ?? null,
      guildId, discordUserId,
    );
  } else {
    db.prepare(`
      INSERT INTO streamers (guild_id, discord_user_id, twitch_username, youtube_channel_id, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).run(guildId, discordUserId, data.twitch_username ?? null, data.youtube_channel_id ?? null);
  }
  return getStreamer(guildId, discordUserId)!;
}

export function setStreamerEnabled(guildId: string, discordUserId: string, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE streamers SET enabled = ?, updated_at = datetime('now') WHERE guild_id = ? AND discord_user_id = ?`)
    .run(enabled ? 1 : 0, guildId, discordUserId);
}

export function deleteStreamer(guildId: string, discordUserId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ?').run(guildId, discordUserId);
  db.prepare('DELETE FROM streamers WHERE guild_id = ? AND discord_user_id = ?').run(guildId, discordUserId);
}

export function countStreamers(guildId: string): { total: number; active: number } {
  const total  = (getDb().prepare('SELECT COUNT(*) as c FROM streamers WHERE guild_id = ?').get(guildId) as { c: number }).c;
  const active = (getDb().prepare('SELECT COUNT(*) as c FROM streamers WHERE guild_id = ? AND enabled = 1').get(guildId) as { c: number }).c;
  return { total, active };
}

// ── stream_live_states ─────────────────────────────────────────────────────────

export function getLiveState(
  guildId: string,
  discordUserId: string,
  platform: 'twitch' | 'youtube',
): StreamLiveState | undefined {
  return getDb()
    .prepare('SELECT * FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ? AND platform = ?')
    .get(guildId, discordUserId, platform) as StreamLiveState | undefined;
}

export function upsertLiveState(
  guildId: string,
  discordUserId: string,
  platform: 'twitch' | 'youtube',
  data: Partial<Omit<StreamLiveState, 'id' | 'guild_id' | 'discord_user_id' | 'platform' | 'created_at' | 'updated_at'>>,
): void {
  const db = getDb();
  const existing = getLiveState(guildId, discordUserId, platform);

  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    if (sets) {
      db.prepare(`UPDATE stream_live_states SET ${sets}, last_checked_at = datetime('now'), updated_at = datetime('now') WHERE guild_id = @guild_id AND discord_user_id = @discord_user_id AND platform = @platform`)
        .run({ guild_id: guildId, discord_user_id: discordUserId, platform, ...data });
    }
  } else {
    db.prepare(`
      INSERT INTO stream_live_states (guild_id, discord_user_id, platform, last_checked_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(guildId, discordUserId, platform);
    if (Object.keys(data).length > 0) {
      upsertLiveState(guildId, discordUserId, platform, data);
    }
  }
}

export function getLiveStatesForStreamer(guildId: string, discordUserId: string): StreamLiveState[] {
  return getDb()
    .prepare('SELECT * FROM stream_live_states WHERE guild_id = ? AND discord_user_id = ?')
    .all(guildId, discordUserId) as StreamLiveState[];
}
```

**Hinweis:** `upsertStreamer` hat einen Schreibfehler oben (doppelter Ansatz) — der erste `db.prepare` Block (INSERT ON CONFLICT) ist überflüssig. Ersetze die gesamte Funktion mit dieser sauberen Version:

```typescript
export function upsertStreamer(
  guildId: string,
  discordUserId: string,
  data: { twitch_username?: string | null; youtube_channel_id?: string | null },
): Streamer {
  const db = getDb();
  const existing = getStreamer(guildId, discordUserId);
  if (existing) {
    db.prepare(`
      UPDATE streamers SET
        twitch_username    = COALESCE(?, twitch_username),
        youtube_channel_id = COALESCE(?, youtube_channel_id),
        updated_at         = datetime('now')
      WHERE guild_id = ? AND discord_user_id = ?
    `).run(data.twitch_username ?? null, data.youtube_channel_id ?? null, guildId, discordUserId);
  } else {
    db.prepare(`
      INSERT INTO streamers (guild_id, discord_user_id, twitch_username, youtube_channel_id, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).run(guildId, discordUserId, data.twitch_username ?? null, data.youtube_channel_id ?? null);
  }
  return getStreamer(guildId, discordUserId)!;
}
```

- [ ] **Step 2: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/streamer/streamer.db.ts
git commit -m "feat(streamer): DB query layer — streamer_config, streamers, stream_live_states"
```

---

## Task 4: Embed-Builder

**Files:**
- Create: `src/features/streamer/streamer.embeds.ts`

- [ ] **Step 1: streamer.embeds.ts erstellen**

```typescript
// src/features/streamer/streamer.embeds.ts
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  UserSelectMenuBuilder, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ChannelType,
} from 'discord.js';
import { SECTOR_COLORS, BRAND } from '../../ui/brand';
import type { StreamerConfig, Streamer, StreamLiveState, WizardState, LiveResult, PingType } from './streamer.types';

const PREFIX = 'str';

export function sid(action: string, guildId: string, userId: string, extra = ''): string {
  return extra
    ? `${PREFIX}:${action}:${guildId}:${userId}:${extra}`
    : `${PREFIX}:${action}:${guildId}:${userId}`;
}

// ── Wizard Embeds ──────────────────────────────────────────────────────────────

export function buildWizardEmbed(step: number, total: number, title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle(`⚙️ Streamer-Setup — Schritt ${step}/${total}: ${title}`)
    .setDescription(description)
    .setFooter({ text: BRAND.FOOTER });
}

export function buildWizardStep1(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<RoleSelectMenuBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(1, 7, 'Streamer-Rolle', 'Wähle die Rolle, die Streamer auf diesem Server erhalten.')],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(sid('wizard:role', guildId, userId))
          .setPlaceholder('🎭 Streamer-Rolle auswählen...'),
      ),
    ],
  };
}

export function buildWizardStep2(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ChannelSelectMenuBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(2, 7, 'Live-Channel', 'Wähle den Channel für Live-Ankündigungen.')],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(sid('wizard:channel', guildId, userId))
          .setPlaceholder('📢 Live-Announcement-Channel auswählen...')
          .addChannelTypes(ChannelType.GuildText),
      ),
    ],
  };
}

export function buildWizardStep3(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(3, 7, 'Twitch API', 'Trage deine Twitch API-Zugangsdaten ein.\nDiese gelten für alle Streamer auf diesem Server.')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:twitch_modal', guildId, userId))
          .setLabel('🟣 Twitch-Daten eintragen')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function buildWizardStep4(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(4, 7, 'YouTube API (optional)', 'YouTube-Integration ist optional.\nWenn du keinen API-Key hast, klicke Überspringen.')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:youtube_modal', guildId, userId))
          .setLabel('🔴 YouTube-Key eintragen')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(sid('wizard:youtube_skip', guildId, userId))
          .setLabel('Überspringen')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildWizardStep5(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(5, 7, 'Prüf-Intervall', 'Wie oft soll der Bot live-Status prüfen?\nStandard: 120 Sekunden (Minimum: 60).')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:interval_modal', guildId, userId))
          .setLabel('⏱ Intervall setzen')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function buildWizardStep6(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(6, 7, 'Ping-Typ', 'Wer soll gepingt werden, wenn ein Streamer live geht?')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(sid('wizard:ping:role', guildId, userId)).setLabel('Streamer-Rolle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:everyone', guildId, userId)).setLabel('@everyone').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:here', guildId, userId)).setLabel('@here').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:none', guildId, userId)).setLabel('Kein Ping').setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildWizardStep7(
  guildId: string, userId: string, state: WizardState, guildName: string,
): { embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>] } {
  const pingLabels: Record<PingType, string> = {
    none: 'Kein Ping', role: 'Streamer-Rolle', everyone: '@everyone', here: '@here',
  };
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle('⚙️ Streamer-Setup — Zusammenfassung')
    .setDescription('Überprüfe deine Einstellungen und schließe das Setup ab.')
    .addFields(
      { name: '🎭 Streamer-Rolle',    value: state.streamer_role_id ? `<@&${state.streamer_role_id}>` : '—', inline: true },
      { name: '📢 Live-Channel',      value: state.live_channel_id  ? `<#${state.live_channel_id}>` : '—',   inline: true },
      { name: '🟣 Twitch',            value: state.twitch_client_id  ? '✅ Eingerichtet' : '❌ Fehlt',         inline: true },
      { name: '🔴 YouTube',           value: state.youtube_api_key   ? '✅ Eingerichtet' : '⏭ Übersprungen',  inline: true },
      { name: '⏱ Intervall',         value: `${state.check_interval_seconds ?? 120} Sekunden`,               inline: true },
      { name: '🔔 Ping',             value: pingLabels[state.announcement_ping_type ?? 'none'],              inline: true },
    )
    .setFooter({ text: BRAND.FOOTER });
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(sid('wizard:finish:enabled', guildId, userId)).setLabel('✅ Aktivieren & Abschließen').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(sid('wizard:finish:disabled', guildId, userId)).setLabel('💾 Deaktiviert speichern').setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function buildDashboardEmbed(config: StreamerConfig, counts: { total: number; active: number }, guildName: string): EmbedBuilder {
  const pingLabels: Record<PingType, string> = {
    none: 'Kein Ping', role: 'Streamer-Rolle', everyone: '@everyone', here: '@here',
  };
  const statusColor = config.enabled ? SECTOR_COLORS.ONLINE_GREEN : SECTOR_COLORS.OFFLINE_RED;
  const statusText  = config.enabled ? '🟢 Aktiv' : '🔴 Inaktiv';

  return new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`🖥️ Streamer-System — ${guildName}`)
    .addFields(
      { name: 'Status',              value: statusText,                                                                   inline: true },
      { name: '🎭 Streamer-Rolle',   value: config.streamer_role_id ? `<@&${config.streamer_role_id}>` : '❌ Nicht gesetzt', inline: true },
      { name: '📢 Live-Channel',     value: config.live_channel_id  ? `<#${config.live_channel_id}>` : '❌ Nicht gesetzt',  inline: true },
      { name: '⏱ Intervall',        value: `${config.check_interval_seconds}s`,                                          inline: true },
      { name: '🔔 Ping',            value: pingLabels[config.announcement_ping_type],                                    inline: true },
      { name: '🟣 Twitch',          value: config.twitch_client_id  ? '✅ Verbunden' : '❌ Nicht eingerichtet',            inline: true },
      { name: '🔴 YouTube',         value: config.youtube_api_key   ? '✅ Verbunden' : '❌ Nicht eingerichtet',            inline: true },
      { name: '👥 Streamer',        value: `${counts.total} gespeichert / ${counts.active} aktiv`,                       inline: true },
      { name: '🕐 Letzter Check',   value: config.last_successful_check ? `<t:${Math.floor(new Date(config.last_successful_check).getTime() / 1000)}:R>` : '—', inline: true },
      { name: '⚠️ Letzter Fehler',  value: config.last_error ?? '—', inline: false },
    )
    .setFooter({ text: BRAND.FOOTER })
    .setTimestamp();
}

export function buildDashboardComponents(config: StreamerConfig, guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const toggleLabel = config.enabled ? '🔴 System deaktivieren' : '🟢 System aktivieren';
  const toggleStyle = config.enabled ? ButtonStyle.Danger : ButtonStyle.Success;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('dashboard:toggle', guildId, userId)).setLabel(toggleLabel).setStyle(toggleStyle),
      new ButtonBuilder().setCustomId(sid('dashboard:settings', guildId, userId)).setLabel('⚙️ Grundeinstellungen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:manage', guildId, userId)).setLabel('👥 Streamer verwalten').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:platforms', guildId, userId)).setLabel('🔧 Plattformen/API').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('dashboard:test', guildId, userId)).setLabel('📢 Testnachricht').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:list', guildId, userId)).setLabel('📋 Streamer-Liste').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('🔄 Aktualisieren').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ── Untermenü-Embeds ───────────────────────────────────────────────────────────

export function buildSettingsMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('⚙️ Grundeinstellungen')
    .setDescription('Wähle eine Einstellung zum Ändern.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildSettingsMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:role', guildId, userId)).setLabel('🎭 Streamer-Rolle ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:channel', guildId, userId)).setLabel('📢 Live-Channel ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:interval', guildId, userId)).setLabel('⏱ Intervall ändern').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:ping', guildId, userId)).setLabel('🔔 Ping-Typ ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildPingMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:ping:role', guildId, userId)).setLabel('Streamer-Rolle').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:everyone', guildId, userId)).setLabel('@everyone').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:here', guildId, userId)).setLabel('@here').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:none', guildId, userId)).setLabel('Kein Ping').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:back', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildPlatformsMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('🔧 Plattformen & API-Verwaltung')
    .setDescription('API-Zugangsdaten werden **niemals** angezeigt.\n`[GESETZT]` bedeutet: ein Wert ist eingetragen.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildPlatformsMenuComponents(config: StreamerConfig, guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('platforms:twitch', guildId, userId)).setLabel('🟣 Twitch API ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('platforms:youtube', guildId, userId)).setLabel('🔴 YouTube API ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('platforms:youtube_disable', guildId, userId)).setLabel('YouTube deaktivieren').setStyle(ButtonStyle.Danger).setDisabled(!config.youtube_api_key),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildManageMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('👥 Streamer verwalten')
    .setDescription('Verwalte die gespeicherten Streamer.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildManageMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:add', guildId, userId)).setLabel('➕ Hinzufügen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(sid('manage:edit', guildId, userId)).setLabel('✏️ Bearbeiten').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:disable', guildId, userId)).setLabel('🚫 Deaktivieren').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:enable', guildId, userId)).setLabel('✅ Aktivieren').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:list', guildId, userId)).setLabel('📋 Liste').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:sync', guildId, userId)).setLabel('🔄 Sync').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── Streamer-Liste (paginiert) ─────────────────────────────────────────────────

export function buildStreamerListEmbed(
  streamers: Streamer[],
  liveStatesMap: Map<string, StreamLiveState[]>,
  roleIds: Set<string>,
  page: number,
  totalPages: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle(`📋 Streamer-Liste (Seite ${page + 1}/${totalPages || 1})`)
    .setFooter({ text: BRAND.FOOTER });

  if (streamers.length === 0) {
    embed.setDescription('Keine Streamer gespeichert.');
    return embed;
  }

  for (const s of streamers) {
    const states = liveStatesMap.get(s.discord_user_id) ?? [];
    const twitchState = states.find(st => st.platform === 'twitch');
    const ytState     = states.find(st => st.platform === 'youtube');
    const hasRole     = roleIds.has(s.discord_user_id);
    const liveTag     = (twitchState?.is_live || ytState?.is_live) ? ' 🔴 LIVE' : '';

    embed.addFields({
      name: `<@${s.discord_user_id}>${liveTag}`,
      value: [
        `🟣 Twitch: ${s.twitch_username ?? '—'}`,
        `🔴 YouTube: ${s.youtube_channel_id ? '✅' : '—'}`,
        `🎭 Rolle: ${hasRole ? '✅' : '❌'}`,
        `Aktiv: ${s.enabled ? '✅' : '🚫'}`,
      ].join('  ·  '),
      inline: false,
    });
  }

  return embed;
}

export function buildStreamerListComponents(
  page: number, totalPages: number, guildId: string, userId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:list', guildId, userId, String(Math.max(0, page - 1)))).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(sid('manage:list', guildId, userId, String(Math.min(totalPages - 1, page + 1)))).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Dashboard').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── Announcement-Embed ─────────────────────────────────────────────────────────

export function buildAnnouncementEmbed(
  result: LiveResult,
  platform: 'twitch' | 'youtube',
  isTest = false,
): EmbedBuilder {
  const platformLabel = platform === 'twitch' ? 'Twitch' : 'YouTube';
  const prefix = isTest ? '[TEST] ' : '';
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`${prefix}🔴 ${result.userName ?? 'Unbekannt'} ist jetzt live auf ${platformLabel}`)
    .setTimestamp();

  const desc: string[] = [];
  if (result.title)      desc.push(`**${result.title}**`);
  if (result.gameName)   desc.push(`🎮 ${result.gameName}`);
  if (result.viewerCount !== undefined) desc.push(`👥 ${result.viewerCount.toLocaleString('de-DE')} Zuschauer`);
  if (desc.length) embed.setDescription(desc.join('\n'));

  if (result.thumbnailUrl) embed.setImage(result.thumbnailUrl);

  return embed;
}

export function buildAnnouncementComponents(url: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('🔗 Zum Stream').setStyle(ButtonStyle.Link).setURL(url),
    ),
  ];
}

// ── Modals ─────────────────────────────────────────────────────────────────────

import { ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export function buildTwitchModal(guildId: string, userId: string, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:twitch_wizard', guildId, userId) : sid('modal:twitch_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Twitch API-Zugangsdaten')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('client_id').setLabel('Twitch Client ID').setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('client_secret').setLabel('Twitch Client Secret').setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}

export function buildYouTubeModal(guildId: string, userId: string, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:youtube_wizard', guildId, userId) : sid('modal:youtube_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('YouTube API-Key')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('api_key').setLabel('YouTube Data API v3 Key').setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}

export function buildIntervalModal(guildId: string, userId: string, current: number, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:interval_wizard', guildId, userId) : sid('modal:interval_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Prüf-Intervall setzen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('interval_secs')
          .setLabel('Intervall in Sekunden (Minimum: 60)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(String(current)),
      ),
    );
}

export function buildStreamerAddModal(guildId: string, userId: string, targetUserId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(sid('modal:streamer_add', guildId, userId, targetUserId))
    .setTitle('Streamer-Plattformen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('twitch_username').setLabel('Twitch Username (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('z.B. dein_twitch_name'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('youtube_channel_id').setLabel('YouTube Channel-ID (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('z.B. UCxxxxxxx'),
      ),
    );
}

export function buildStreamerEditModal(guildId: string, userId: string, streamer: Streamer): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(sid('modal:streamer_edit', guildId, userId, streamer.discord_user_id))
    .setTitle('Streamer bearbeiten')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('twitch_username')
          .setLabel('Twitch Username (leer = unverändert)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(streamer.twitch_username ?? ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('youtube_channel_id')
          .setLabel('YouTube Channel-ID (leer = unverändert)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(streamer.youtube_channel_id ?? ''),
      ),
    );
}

// ── Streamer-Select-Menüs ──────────────────────────────────────────────────────

export function buildStreamerSelectMenu(
  streamers: Streamer[],
  customId: string,
  placeholder: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = streamers.slice(0, 25).map(s =>
    new StringSelectMenuOptionBuilder()
      .setValue(s.discord_user_id)
      .setLabel(`<@${s.discord_user_id}>`.slice(0, 100))
      .setDescription(`Twitch: ${s.twitch_username ?? '—'} | YT: ${s.youtube_channel_id ? '✅' : '—'}`.slice(0, 100)),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options),
  );
}

export function buildConfirmDeleteComponents(
  guildId: string, userId: string, targetUserId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:confirm_disable', guildId, userId, targetUserId)).setLabel('🚫 Deaktivieren').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:confirm_delete', guildId, userId, targetUserId)).setLabel('🗑️ Komplett löschen').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(sid('manage:back', guildId, userId)).setLabel('Abbrechen').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── User-Select für Streamer-Hinzufügen ───────────────────────────────────────

export function buildUserSelectComponents(guildId: string, userId: string): ActionRowBuilder<UserSelectMenuBuilder>[] {
  return [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(sid('manage:user_select', guildId, userId))
        .setPlaceholder('Discord-User auswählen...'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:back', guildId, userId)).setLabel('↩ Abbrechen').setStyle(ButtonStyle.Secondary),
    ),
  ];
}
```

- [ ] **Step 2: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/streamer/streamer.embeds.ts
git commit -m "feat(streamer): all embed builders, modals, component factories"
```

---

## Task 5: Slash-Command + Wizard

**Files:**
- Create: `src/commands/streamer.ts`
- Create: `src/features/streamer/streamer.wizard.ts`

- [ ] **Step 1: /streamer Slash-Command erstellen**

```typescript
// src/commands/streamer.ts
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import { getStreamerConfig, upsertStreamerConfig, countStreamers } from '../features/streamer/streamer.db';
import { buildDashboardEmbed, buildDashboardComponents, buildWizardStep1 } from '../features/streamer/streamer.embeds';
import type { Command } from '../types';

export const streamerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('streamer')
    .setDescription('Streamer-Live-Announcement-System verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst **Server verwalten**-Berechtigung.');
    }

    const { guild, user } = interaction;
    const guildId = guild.id;
    const userId  = user.id;

    let config = getStreamerConfig(guildId);
    if (!config) {
      config = upsertStreamerConfig(guildId, {});
    }

    if (!config.setup_completed) {
      const step1 = buildWizardStep1(guildId, userId);
      return interaction.reply({ ...step1, ephemeral: true });
    }

    const counts = countStreamers(guildId);
    const embed  = buildDashboardEmbed(config, counts, guild.name);
    const rows   = buildDashboardComponents(config, guildId, userId);
    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  },
};
```

- [ ] **Step 2: streamer.wizard.ts erstellen**

```typescript
// src/features/streamer/streamer.wizard.ts
import type { ButtonInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { replyError } from '../../utils/errors';
import { upsertStreamerConfig, getStreamerConfig, countStreamers } from './streamer.db';
import { clearTwitchTokenCache } from './streamer.twitch';
import {
  buildWizardStep2, buildWizardStep3, buildWizardStep4,
  buildWizardStep5, buildWizardStep6, buildWizardStep7,
  buildDashboardEmbed, buildDashboardComponents,
  buildTwitchModal, buildYouTubeModal, buildIntervalModal,
} from './streamer.embeds';
import type { WizardState, PingType } from './streamer.types';

// ── Wizard-State (In-Memory, 30-min TTL) ──────────────────────────────────────

const wizardStates = new Map<string, WizardState>();
const WIZARD_TTL_MS = 30 * 60 * 1000;

function wizardKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getWizardState(guildId: string, userId: string): WizardState | null {
  const state = wizardStates.get(wizardKey(guildId, userId));
  if (!state) return null;
  if (Date.now() > state.expiresAt) { wizardStates.delete(wizardKey(guildId, userId)); return null; }
  return state;
}

export function setWizardState(guildId: string, userId: string, state: Partial<WizardState>): WizardState {
  const existing = getWizardState(guildId, userId) ?? { step: 1, expiresAt: 0 };
  const updated: WizardState = { ...existing, ...state, expiresAt: Date.now() + WIZARD_TTL_MS };
  wizardStates.set(wizardKey(guildId, userId), updated);
  return updated;
}

export function clearWizardState(guildId: string, userId: string): void {
  wizardStates.delete(wizardKey(guildId, userId));
}

// ── Security-Check ─────────────────────────────────────────────────────────────

function parsePayloadIds(payload: string): { action: string; guildId: string; userId: string; extra: string } {
  // payload format: "wizard:step:guildId:userId" or "wizard:step:guildId:userId:extra"
  const parts = payload.split(':');
  // For "wizard:role:GUILDID:USERID" → parts = ["wizard","role","GUILDID","USERID"]
  // We need to find guildId and userId — they are always the last 2 before optional extra
  // The action is everything before the guildId
  // Since guildIds are 17-20 digit snowflakes, we identify them by position
  // Simpler: always store as action:guildId:userId or action:sub:guildId:userId
  if (parts.length === 4) {
    return { action: `${parts[0]}:${parts[1]}`, guildId: parts[2], userId: parts[3], extra: '' };
  }
  if (parts.length === 5) {
    return { action: `${parts[0]}:${parts[1]}:${parts[2]}`, guildId: parts[3], userId: parts[4], extra: '' };
  }
  return { action: parts.slice(0, -3).join(':'), guildId: parts[parts.length - 2], userId: parts[parts.length - 1], extra: '' };
}

export function checkWizardOwner(interaction: { user: { id: string } }, userId: string): boolean {
  return interaction.user.id === userId;
}

// ── Role Select — Step 1 → 2 ─────────────────────────────────────────────────

export async function handleWizardRoleSelect(
  interaction: RoleSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guildId, userId } = parseWizardIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    return replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
  }

  const role = interaction.roles.first();
  if (!role) return replyError(interaction, 'Keine Rolle ausgewählt.');

  setWizardState(guildId, userId, { step: 2, streamer_role_id: role.id });
  return interaction.update(buildWizardStep2(guildId, userId));
}

// ── Channel Select — Step 2 → 3 ──────────────────────────────────────────────

export async function handleWizardChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guildId, userId } = parseWizardIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    return replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
  }

  const channel = interaction.channels.first();
  if (!channel) return replyError(interaction, 'Kein Channel ausgewählt.');

  setWizardState(guildId, userId, { step: 3, live_channel_id: channel.id });
  return interaction.update(buildWizardStep3(guildId, userId));
}

// ── Buttons: Twitch/YouTube Modal öffnen, Skip, Ping, Finish ─────────────────

export async function handleWizardButton(
  interaction: ButtonInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { action, guildId, userId } = parseWizardButtonIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    return replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
  }

  const state = getWizardState(guildId, userId);

  if (action === 'twitch_modal') {
    return interaction.showModal(buildTwitchModal(guildId, userId, true));
  }

  if (action === 'youtube_modal') {
    return interaction.showModal(buildYouTubeModal(guildId, userId, true));
  }

  if (action === 'youtube_skip') {
    setWizardState(guildId, userId, { step: 5, youtube_api_key: null });
    return interaction.update(buildWizardStep5(guildId, userId));
  }

  if (action === 'interval_modal') {
    const current = state?.check_interval_seconds ?? 120;
    return interaction.showModal(buildIntervalModal(guildId, userId, current, true));
  }

  if (action.startsWith('ping:')) {
    const pingType = action.split(':')[1] as PingType;
    setWizardState(guildId, userId, { step: 7, announcement_ping_type: pingType });
    const updated = getWizardState(guildId, userId)!;
    return interaction.update(buildWizardStep7(guildId, userId, updated, interaction.guild!.name));
  }

  if (action.startsWith('finish:')) {
    const enabled = action.endsWith('enabled');
    await finishWizard(interaction, guildId, userId, enabled);
    return;
  }
}

async function finishWizard(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const state = getWizardState(guildId, userId);
  if (!state?.streamer_role_id || !state.live_channel_id || !state.twitch_client_id) {
    return replyError(interaction, 'Setup unvollständig. Bitte alle Pflichtfelder ausfüllen.');
  }

  upsertStreamerConfig(guildId, {
    enabled:                enabled ? 1 : 0,
    setup_completed:        1,
    streamer_role_id:       state.streamer_role_id,
    live_channel_id:        state.live_channel_id,
    check_interval_seconds: state.check_interval_seconds ?? 120,
    twitch_client_id:       state.twitch_client_id,
    twitch_client_secret:   state.twitch_client_secret,
    youtube_api_key:        state.youtube_api_key ?? null,
    announcement_ping_type: state.announcement_ping_type ?? 'none',
  });

  clearWizardState(guildId, userId);

  const config = getStreamerConfig(guildId)!;
  const counts = countStreamers(guildId);
  await interaction.update({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Modal Submissions ──────────────────────────────────────────────────────────

export async function handleWizardModal(
  interaction: ModalSubmitInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  // payload format: "modal:twitch_wizard:guildId:userId" etc.
  const parts = payload.split(':');
  const modalType = parts[1]; // "twitch_wizard" | "youtube_wizard" | "interval_wizard"
  const guildId   = parts[2];
  const userId    = parts[3];

  if (!checkWizardOwner(interaction, userId)) {
    return replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
  }

  if (modalType === 'twitch_wizard') {
    const clientId     = interaction.fields.getTextInputValue('client_id').trim();
    const clientSecret = interaction.fields.getTextInputValue('client_secret').trim();
    setWizardState(guildId, userId, { step: 4, twitch_client_id: clientId, twitch_client_secret: clientSecret });
    return interaction.update(buildWizardStep4(guildId, userId));
  }

  if (modalType === 'youtube_wizard') {
    const apiKey = interaction.fields.getTextInputValue('api_key').trim();
    setWizardState(guildId, userId, { step: 5, youtube_api_key: apiKey });
    return interaction.update(buildWizardStep5(guildId, userId));
  }

  if (modalType === 'interval_wizard') {
    const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
    const secs = parseInt(raw, 10);
    if (isNaN(secs) || secs < 60) {
      return replyError(interaction, 'Ungültiger Wert. Minimum: 60 Sekunden.');
    }
    setWizardState(guildId, userId, { step: 6, check_interval_seconds: secs });
    return interaction.update(buildWizardStep6(guildId, userId));
  }
}

// ── Hilfsfunktionen für Payload-Parsing ───────────────────────────────────────

function parseWizardIds(payload: string): { guildId: string; userId: string } {
  // payload: "wizard:role:GUILDID:USERID"
  const parts = payload.split(':');
  return { guildId: parts[parts.length - 2], userId: parts[parts.length - 1] };
}

function parseWizardButtonIds(payload: string): { action: string; guildId: string; userId: string } {
  // payload: "wizard:ACTION:GUILDID:USERID" or "wizard:ACTION:SUBACTION:GUILDID:USERID"
  const parts = payload.split(':');
  const guildId = parts[parts.length - 2];
  const userId  = parts[parts.length - 1];
  // action is parts[1] or parts[1]+":"+parts[2] if not a snowflake
  const actionParts = parts.slice(1, parts.length - 2);
  return { action: actionParts.join(':'), guildId, userId };
}
```

- [ ] **Step 3: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/commands/streamer.ts src/features/streamer/streamer.wizard.ts
git commit -m "feat(streamer): /streamer command and 7-step setup wizard"
```

---

## Task 6: Dashboard + Untermenüs

**Files:**
- Create: `src/features/streamer/streamer.dashboard.ts`

- [ ] **Step 1: streamer.dashboard.ts erstellen**

```typescript
// src/features/streamer/streamer.dashboard.ts
import type {
  ButtonInteraction, RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction, StringSelectMenuInteraction,
  UserSelectMenuInteraction, ModalSubmitInteraction, Client,
} from 'discord.js';
import { replyError } from '../../utils/errors';
import { isAdmin } from '../../services/permissionService';
import {
  getStreamerConfig, upsertStreamerConfig, countStreamers,
  getEnabledStreamers, getAllStreamers, upsertStreamer,
  setStreamerEnabled, deleteStreamer, getLiveStatesForStreamer,
} from './streamer.db';
import { clearTwitchTokenCache } from './streamer.twitch';
import { startGuildInterval, stopGuildInterval } from './streamer.checker';
import {
  buildDashboardEmbed, buildDashboardComponents,
  buildSettingsMenuEmbed, buildSettingsMenuComponents,
  buildPlatformsMenuEmbed, buildPlatformsMenuComponents,
  buildManageMenuEmbed, buildManageMenuComponents,
  buildStreamerListEmbed, buildStreamerListComponents,
  buildPingMenuComponents, buildUserSelectComponents,
  buildStreamerSelectMenu, buildConfirmDeleteComponents,
  buildStreamerAddModal, buildStreamerEditModal,
  buildTwitchModal, buildYouTubeModal, buildIntervalModal,
  buildAnnouncementEmbed, buildAnnouncementComponents,
  sid,
} from './streamer.embeds';
import type { PingType, StreamLiveState } from './streamer.types';

const PAGE_SIZE = 10;

// ── Security helpers ───────────────────────────────────────────────────────────

function parseIds(payload: string): { guildId: string; userId: string; extra: string } {
  const parts = payload.split(':');
  // Last two parts are always userId, but we need to know the layout.
  // Layout: "dashboard:action:GUILDID:USERID" → parts = ["dashboard","action","G","U"]
  // Layout: "manage:confirm_delete:GUILDID:USERID:TARGETID" → extra = TARGETID
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  const extra   = parts.length > 4 ? parts[parts.length - 3] : '';
  // But for "manage:list:G:U:PAGE", extra = PAGE
  // For "manage:confirm_delete:G:U:TARGET", extra = TARGET
  // We handle extra case-by-case in each handler
  return { guildId, userId, extra };
}

function securityCheck(interaction: { user: { id: string }; inCachedGuild(): boolean }, userId: string): boolean {
  return interaction.user.id === userId;
}

async function rejectUnauthorized(interaction: ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
  return replyError(interaction, 'Du hast dieses Dashboard nicht geöffnet.');
}

// ── Haupt-Dashboard neu rendern ────────────────────────────────────────────────

async function refreshDashboard(
  interaction: ButtonInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction | StringSelectMenuInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config) return replyError(interaction as ButtonInteraction, 'Keine Konfiguration gefunden.');
  const counts = countStreamers(guildId);
  return interaction.update({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Button-Handler ─────────────────────────────────────────────────────────────

export async function handleDashboardButton(
  interaction: ButtonInteraction,
  payload: string,
  client: Client,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');

  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];

  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);

  // Action: everything before guildId
  const action = parts.slice(0, parts.length - 2).join(':');

  // ── Dashboard-Aktionen ──

  if (action === 'dashboard:refresh') {
    return refreshDashboard(interaction, guildId, userId);
  }

  if (action === 'dashboard:toggle') {
    const config = getStreamerConfig(guildId);
    if (!config) return replyError(interaction, 'Keine Konfiguration gefunden.');
    const newEnabled = config.enabled ? 0 : 1;
    upsertStreamerConfig(guildId, { enabled: newEnabled });
    if (newEnabled) startGuildInterval(client, guildId);
    else stopGuildInterval(guildId);
    return refreshDashboard(interaction, guildId, userId);
  }

  if (action === 'dashboard:settings') {
    return interaction.update({
      embeds:     [buildSettingsMenuEmbed()],
      components: buildSettingsMenuComponents(guildId, userId),
    });
  }

  if (action === 'dashboard:manage') {
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
    });
  }

  if (action === 'dashboard:platforms') {
    const config = getStreamerConfig(guildId)!;
    return interaction.update({
      embeds:     [buildPlatformsMenuEmbed()],
      components: buildPlatformsMenuComponents(config, guildId, userId),
    });
  }

  if (action === 'dashboard:test') {
    return handleTestAnnouncement(interaction, guildId, userId);
  }

  if (action === 'dashboard:list') {
    return handleStreamerList(interaction, guildId, userId, 0);
  }

  // ── Grundeinstellungen ──

  if (action === 'settings:role') {
    const { RoleSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
    const { sid } = await import('./streamer.embeds');
    return interaction.update({
      embeds: [buildSettingsMenuEmbed()],
      components: [
        new ActionRowBuilder<typeof RoleSelectMenuBuilder.prototype>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(sid('settings:role_select', guildId, userId))
            .setPlaceholder('Neue Streamer-Rolle auswählen...'),
        ),
      ],
    });
  }

  if (action === 'settings:channel') {
    const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = await import('discord.js');
    const { sid } = await import('./streamer.embeds');
    return interaction.update({
      embeds: [buildSettingsMenuEmbed()],
      components: [
        new ActionRowBuilder<typeof ChannelSelectMenuBuilder.prototype>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(sid('settings:channel_select', guildId, userId))
            .setPlaceholder('Neuen Live-Channel auswählen...')
            .addChannelTypes(ChannelType.GuildText),
        ),
      ],
    });
  }

  if (action === 'settings:interval') {
    const config = getStreamerConfig(guildId);
    return interaction.showModal(buildIntervalModal(guildId, userId, config?.check_interval_seconds ?? 120, false));
  }

  if (action === 'settings:ping') {
    return interaction.update({
      embeds:     [buildSettingsMenuEmbed()],
      components: buildPingMenuComponents(guildId, userId),
    });
  }

  if (action.startsWith('settings:ping:')) {
    const subAction = action.split(':')[2];
    if (subAction === 'back') {
      return interaction.update({
        embeds:     [buildSettingsMenuEmbed()],
        components: buildSettingsMenuComponents(guildId, userId),
      });
    }
    upsertStreamerConfig(guildId, { announcement_ping_type: subAction as PingType });
    return refreshDashboard(interaction, guildId, userId);
  }

  // ── Plattformen ──

  if (action === 'platforms:twitch') {
    return interaction.showModal(buildTwitchModal(guildId, userId, false));
  }

  if (action === 'platforms:youtube') {
    return interaction.showModal(buildYouTubeModal(guildId, userId, false));
  }

  if (action === 'platforms:youtube_disable') {
    upsertStreamerConfig(guildId, { youtube_api_key: null });
    return refreshDashboard(interaction, guildId, userId);
  }

  // ── Streamer verwalten ──

  if (action === 'manage:add') {
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildUserSelectComponents(guildId, userId),
    });
  }

  if (action === 'manage:edit') {
    const streamers = getAllStreamers(guildId);
    if (streamers.length === 0) return replyError(interaction, 'Keine Streamer gespeichert.');
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:edit_select', guildId, userId), 'Streamer zum Bearbeiten auswählen...')],
    });
  }

  if (action === 'manage:disable') {
    const streamers = getAllStreamers(guildId).filter(s => s.enabled);
    if (streamers.length === 0) return replyError(interaction, 'Keine aktiven Streamer vorhanden.');
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:disable_select', guildId, userId), 'Streamer zum Deaktivieren auswählen...')],
    });
  }

  if (action === 'manage:enable') {
    const streamers = getAllStreamers(guildId).filter(s => !s.enabled);
    if (streamers.length === 0) return replyError(interaction, 'Keine deaktivierten Streamer vorhanden.');
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:enable_select', guildId, userId), 'Streamer aktivieren...')],
    });
  }

  if (action === 'manage:list') {
    const extra = parts[parts.length - 3];
    const page  = /^\d+$/.test(extra) ? parseInt(extra, 10) : 0;
    return handleStreamerList(interaction, guildId, userId, page);
  }

  if (action === 'manage:sync') {
    return handleSync(interaction, guildId, userId);
  }

  if (action === 'manage:back') {
    return interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
    });
  }

  if (action.startsWith('manage:confirm_disable:')) {
    const targetId = action.split(':')[2];
    setStreamerEnabled(guildId, targetId, false);
    return interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
  }

  if (action.startsWith('manage:confirm_delete:')) {
    const targetId = action.split(':')[2];
    deleteStreamer(guildId, targetId);
    return interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
  }
}

// ── Streamer-Liste ─────────────────────────────────────────────────────────────

async function handleStreamerList(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
  page: number,
): Promise<void> {
  const config    = getStreamerConfig(guildId);
  const streamers = getAllStreamers(guildId);
  const total     = streamers.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const pageData  = streamers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const liveStatesMap = new Map<string, StreamLiveState[]>();
  for (const s of pageData) {
    liveStatesMap.set(s.discord_user_id, getLiveStatesForStreamer(guildId, s.discord_user_id));
  }

  const roleIds = new Set<string>();
  if (config?.streamer_role_id) {
    try {
      const guild  = interaction.guild!;
      const role   = await guild.roles.fetch(config.streamer_role_id).catch(() => null);
      if (role) role.members.forEach(m => roleIds.add(m.id));
    } catch { /* best-effort */ }
  }

  return interaction.update({
    embeds:     [buildStreamerListEmbed(pageData, liveStatesMap, roleIds, page, totalPages)],
    components: buildStreamerListComponents(page, totalPages, guildId, userId),
  });
}

// ── Test-Announcement ─────────────────────────────────────────────────────────

async function handleTestAnnouncement(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config?.live_channel_id) {
    return replyError(interaction, 'Kein Live-Channel konfiguriert.');
  }

  const channel = await interaction.guild!.channels.fetch(config.live_channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    return replyError(interaction, 'Live-Channel nicht gefunden oder ungültig.');
  }

  await interaction.deferUpdate();

  const testResult = {
    isLive: true, streamId: 'test', title: 'Teststream — Alles funktioniert!',
    gameName: 'SCUM', viewerCount: 42, userName: 'TestStreamer',
    url: 'https://twitch.tv/test', thumbnailUrl: undefined,
  };

  const embed      = buildAnnouncementEmbed(testResult, 'twitch', true);
  const components = buildAnnouncementComponents(testResult.url);
  await channel.send({ content: '[TEST]', embeds: [embed], components });

  const counts = countStreamers(guildId);
  return interaction.editReply({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function handleSync(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config?.streamer_role_id) return replyError(interaction, 'Keine Streamer-Rolle konfiguriert.');

  await interaction.deferUpdate();

  const guild = interaction.guild!;
  const role  = await guild.roles.fetch(config.streamer_role_id).catch(() => null);
  if (!role) {
    return interaction.editReply({ content: 'Streamer-Rolle nicht gefunden.', embeds: [], components: [] });
  }

  const existing  = new Set(getAllStreamers(guildId).map(s => s.discord_user_id));
  const newMembers = role.members.filter(m => !existing.has(m.id));

  if (newMembers.size === 0) {
    const counts = countStreamers(guildId);
    return interaction.editReply({
      embeds:     [buildDashboardEmbed(config, counts, guild.name)],
      components: buildDashboardComponents(config, guildId, userId),
    });
  }

  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🔄 Sync: Neue Rollenmitglieder')
    .setDescription(
      `Folgende Mitglieder haben die Streamer-Rolle, sind aber noch nicht eingetragen:\n` +
      newMembers.map(m => `• <@${m.id}>`).join('\n') +
      `\n\nFüge sie einzeln über **Streamer hinzufügen** ein.`,
    );

  const counts = countStreamers(guildId);
  return interaction.editReply({
    embeds:     [embed, buildDashboardEmbed(config, counts, guild.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Role Select (Settings) ─────────────────────────────────────────────────────

export async function handleDashboardRoleSelect(
  interaction: RoleSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');
  const parts  = payload.split(':');
  const userId = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);
  const role = interaction.roles.first();
  if (!role) return replyError(interaction, 'Keine Rolle ausgewählt.');
  upsertStreamerConfig(guildId, { streamer_role_id: role.id });
  return refreshDashboard(interaction, guildId, userId);
}

// ── Channel Select (Settings) ──────────────────────────────────────────────────

export async function handleDashboardChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');
  const parts  = payload.split(':');
  const userId = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);
  const channel = interaction.channels.first();
  if (!channel) return replyError(interaction, 'Kein Channel ausgewählt.');
  upsertStreamerConfig(guildId, { live_channel_id: channel.id });
  return refreshDashboard(interaction, guildId, userId);
}

// ── String Select (Edit/Disable/Enable Streamer) ──────────────────────────────

export async function handleDashboardStringSelect(
  interaction: StringSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');
  const parts    = payload.split(':');
  const userId   = parts[parts.length - 1];
  const guildId  = parts[parts.length - 2];
  const action   = parts.slice(0, parts.length - 2).join(':');
  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);

  const targetId = interaction.values[0];

  if (action === 'manage:edit_select') {
    const { getStreamer } = await import('./streamer.db');
    const streamer = getStreamer(guildId, targetId);
    if (!streamer) return replyError(interaction, 'Streamer nicht gefunden.');
    return interaction.showModal(buildStreamerEditModal(guildId, userId, streamer));
  }

  if (action === 'manage:disable_select') {
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder().setTitle('Streamer deaktivieren/löschen?').setDescription(`<@${targetId}>`);
    return interaction.update({
      embeds:     [embed],
      components: buildConfirmDeleteComponents(guildId, userId, targetId),
    });
  }

  if (action === 'manage:enable_select') {
    setStreamerEnabled(guildId, targetId, true);
    return interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
  }
}

// ── User Select (Streamer hinzufügen) ─────────────────────────────────────────

export async function handleDashboardUserSelect(
  interaction: UserSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');
  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);

  const targetUser = interaction.users.first();
  if (!targetUser) return replyError(interaction, 'Keinen User ausgewählt.');
  if (targetUser.bot)  return replyError(interaction, 'Bots können nicht als Streamer eingetragen werden.');

  return interaction.showModal(buildStreamerAddModal(guildId, userId, targetUser.id));
}

// ── Modal Submissions (Settings & Manage) ─────────────────────────────────────

export async function handleDashboardModal(
  interaction: ModalSubmitInteraction,
  payload: string,
  client: Client,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) return replyError(interaction, 'Keine Berechtigung.');

  const parts     = payload.split(':');
  const modalType = parts[1];
  const guildId   = parts[2];
  const userId    = parts[3];
  const extra     = parts[4] ?? '';

  if (!securityCheck(interaction, userId)) return rejectUnauthorized(interaction);

  if (modalType === 'twitch_settings') {
    const clientId     = interaction.fields.getTextInputValue('client_id').trim();
    const clientSecret = interaction.fields.getTextInputValue('client_secret').trim();
    upsertStreamerConfig(guildId, { twitch_client_id: clientId, twitch_client_secret: clientSecret });
    clearTwitchTokenCache(guildId);
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    return interaction.update({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
    });
  }

  if (modalType === 'youtube_settings') {
    const apiKey = interaction.fields.getTextInputValue('api_key').trim();
    upsertStreamerConfig(guildId, { youtube_api_key: apiKey });
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    return interaction.update({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
    });
  }

  if (modalType === 'interval_settings') {
    const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
    const secs = parseInt(raw, 10);
    if (isNaN(secs) || secs < 60) return replyError(interaction, 'Ungültiger Wert. Minimum: 60 Sekunden.');
    upsertStreamerConfig(guildId, { check_interval_seconds: secs });
    startGuildInterval(client, guildId); // Interval neu starten
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    return interaction.update({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
    });
  }

  if (modalType === 'streamer_add') {
    const targetUserId    = extra;
    const twitchUsername  = interaction.fields.getTextInputValue('twitch_username').trim() || null;
    const youtubeChannelId = interaction.fields.getTextInputValue('youtube_channel_id').trim() || null;

    if (!twitchUsername && !youtubeChannelId) {
      return replyError(interaction, 'Mindestens eine Plattform (Twitch oder YouTube) muss angegeben werden.');
    }

    upsertStreamer(guildId, targetUserId, { twitch_username: twitchUsername, youtube_channel_id: youtubeChannelId });

    const config = getStreamerConfig(guildId);
    const hasRole = config?.streamer_role_id
      ? interaction.guild!.members.cache.get(targetUserId)?.roles.cache.has(config.streamer_role_id) ?? false
      : false;

    const { EmbedBuilder } = await import('discord.js');
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Streamer gespeichert')
      .setDescription(
        `<@${targetUserId}> wurde als Streamer eingetragen.\n` +
        (hasRole ? '' : '\n⚠️ Dieser User hat die Streamer-Rolle noch nicht — er wird erst überwacht, wenn die Rolle vergeben wurde.'),
      );

    return interaction.update({
      embeds:     [confirmEmbed, buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
    });
  }

  if (modalType === 'streamer_edit') {
    const targetUserId     = extra;
    const twitchUsername   = interaction.fields.getTextInputValue('twitch_username').trim() || null;
    const youtubeChannelId = interaction.fields.getTextInputValue('youtube_channel_id').trim() || null;

    upsertStreamer(guildId, targetUserId, {
      twitch_username:    twitchUsername,
      youtube_channel_id: youtubeChannelId,
    });

    return interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
  }
}
```

- [ ] **Step 2: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/streamer/streamer.dashboard.ts
git commit -m "feat(streamer): full dashboard with all submenus and streamer management"
```

---

## Task 7: Live-Checker + Announcements

**Files:**
- Create: `src/features/streamer/streamer.checker.ts`

- [ ] **Step 1: streamer.checker.ts erstellen**

```typescript
// src/features/streamer/streamer.checker.ts
import type { Client } from 'discord.js';
import { logger } from '../../utils/logger';
import {
  getAllActiveStreamerConfigs, getStreamerConfig,
  getEnabledStreamers, getLiveState, upsertLiveState,
  setStreamerLastSuccessfulCheck, setStreamerLastError,
} from './streamer.db';
import { checkTwitchStream } from './streamer.twitch';
import { checkYouTubeStream } from './streamer.youtube';
import { buildAnnouncementEmbed, buildAnnouncementComponents } from './streamer.embeds';
import type { StreamerConfig, Streamer, LiveResult } from './streamer.types';

const MIN_INTERVAL_MS = 60_000;
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();
let _client: Client;

// ── Public API ────────────────────────────────────────────────────────────────

export function setupStreamerChecker(client: Client): void {
  _client = client;
  client.once('ready', async () => {
    const configs = getAllActiveStreamerConfigs();
    for (const config of configs) {
      startGuildInterval(client, config.guild_id);
    }
    logger.info(`[streamer] ${configs.length} Live-Checker gestartet.`);
  });
}

export function startGuildInterval(client: Client, guildId: string): void {
  _client = client;
  stopGuildInterval(guildId);

  const config = getStreamerConfig(guildId);
  if (!config?.enabled || !config.setup_completed) return;

  const ms = Math.max(config.check_interval_seconds * 1000, MIN_INTERVAL_MS);

  void runGuildCheck(guildId);
  activeIntervals.set(guildId, setInterval(() => void runGuildCheck(guildId), ms));
}

export function stopGuildInterval(guildId: string): void {
  const existing = activeIntervals.get(guildId);
  if (existing) { clearInterval(existing); activeIntervals.delete(guildId); }
}

// ── Check-Logik ───────────────────────────────────────────────────────────────

async function runGuildCheck(guildId: string): Promise<void> {
  try {
    const config = getStreamerConfig(guildId);
    if (!config?.enabled || !config.setup_completed || !config.streamer_role_id || !config.live_channel_id) {
      stopGuildInterval(guildId);
      return;
    }

    const guild = await _client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const streamers = getEnabledStreamers(guildId);

    for (const streamer of streamers) {
      try {
        const member = await guild.members.fetch(streamer.discord_user_id).catch(() => null);
        if (!member) continue;
        if (!member.roles.cache.has(config.streamer_role_id)) continue;

        if (config.twitch_client_id && config.twitch_client_secret && streamer.twitch_username) {
          const result = await checkTwitchStream(config, streamer.twitch_username);
          await handleLiveStateChange(config, streamer, 'twitch', result);
        }

        if (config.youtube_api_key && streamer.youtube_channel_id) {
          const result = await checkYouTubeStream(config.youtube_api_key, streamer.youtube_channel_id);
          await handleLiveStateChange(config, streamer, 'youtube', result);
        }
      } catch (streamerErr) {
        logger.warn(`[streamer] Fehler bei Streamer ${streamer.discord_user_id}: ${streamerErr}`);
      }
    }

    setStreamerLastSuccessfulCheck(guildId);
  } catch (err) {
    logger.error(`[streamer] Check-Fehler für Guild ${guildId}: ${err}`);
    setStreamerLastError(guildId, String(err));
  }
}

// ── State-Übergang + Announcement ─────────────────────────────────────────────

async function handleLiveStateChange(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
): Promise<void> {
  const { guild_id, discord_user_id } = streamer;
  const state = getLiveState(guild_id, discord_user_id, platform);
  const wasLive = (state?.is_live ?? 0) === 1;

  if (!wasLive && result.isLive) {
    // Offline → Live: Announcement senden
    await sendAnnouncement(config, streamer, platform, result);
  } else if (wasLive && result.isLive) {
    // Noch live: Nachricht aktualisieren
    await updateAnnouncement(config, streamer, platform, result, state?.announcement_message_id ?? null);
  } else if (wasLive && !result.isLive) {
    // Live → Offline
    upsertLiveState(guild_id, discord_user_id, platform, {
      is_live:                 0,
      announcement_message_id: null,
    });
  }
  // Offline → Offline: nichts tun
}

async function sendAnnouncement(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
): Promise<void> {
  const channel = await _client.channels.fetch(config.live_channel_id!).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed      = buildAnnouncementEmbed(result, platform);
  const components = buildAnnouncementComponents(result.url!);
  const content    = buildPingContent(config);

  const msg = await channel.send({ content, embeds: [embed], components });

  upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
    is_live:                 1,
    last_stream_id:          result.streamId ?? null,
    last_live_url:           result.url ?? null,
    last_live_title:         result.title ?? null,
    announcement_message_id: msg.id,
    last_announced_at:       new Date().toISOString(),
  });
}

async function updateAnnouncement(
  config: StreamerConfig,
  streamer: Streamer,
  platform: 'twitch' | 'youtube',
  result: LiveResult,
  messageId: string | null,
): Promise<void> {
  upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
    last_live_title: result.title ?? null,
  });

  if (!messageId) return;

  try {
    const channel = await _client.channels.fetch(config.live_channel_id!).catch(() => null);
    if (!channel?.isTextBased()) return;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) {
      // Nachricht gelöscht — messageId leeren, nächster Offline→Online sendet neu
      upsertLiveState(streamer.guild_id, streamer.discord_user_id, platform, {
        announcement_message_id: null,
      });
      return;
    }

    const embed      = buildAnnouncementEmbed(result, platform);
    const components = buildAnnouncementComponents(result.url!);
    await msg.edit({ embeds: [embed], components });
  } catch (err) {
    logger.warn(`[streamer] Announcement-Update fehlgeschlagen: ${err}`);
  }
}

function buildPingContent(config: StreamerConfig): string | undefined {
  switch (config.announcement_ping_type) {
    case 'role':     return config.streamer_role_id ? `<@&${config.streamer_role_id}>` : undefined;
    case 'everyone': return '@everyone';
    case 'here':     return '@here';
    default:         return undefined;
  }
}
```

- [ ] **Step 2: Build prüfen**

```bash
npm run build
```

Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/streamer/streamer.checker.ts
git commit -m "feat(streamer): live checker with per-guild intervals and state machine"
```

---

## Task 8: Bot-Integration + Deploy

**Files:**
- Modify: `src/index.ts`
- Modify: `src/deploy.ts`

- [ ] **Step 1: Alle Handler in src/index.ts registrieren**

Imports hinzufügen:
```typescript
import { streamerCommand } from './commands/streamer';
import { setupStreamerChecker } from './features/streamer/streamer.checker';
import {
  handleWizardButton, handleWizardRoleSelect,
  handleWizardChannelSelect, handleWizardModal,
} from './features/streamer/streamer.wizard';
import {
  handleDashboardButton, handleDashboardRoleSelect,
  handleDashboardChannelSelect, handleDashboardStringSelect,
  handleDashboardUserSelect, handleDashboardModal,
} from './features/streamer/streamer.dashboard';
```

Command registrieren (in der commands-for-Schleife ergänzen):
```typescript
commands.set(streamerCommand.data.name, streamerCommand);
```

Jetzt die Handler registrieren. Da alle unter Prefix `str` laufen, erstellen wir inline-Handler die intern nach action dispatchen:

```typescript
// Streamer Button Handler
buttonHandlers.set('str', {
  prefix: 'str',
  async execute(interaction, payload) {
    if (payload.startsWith('wizard:')) {
      return handleWizardButton(interaction, payload);
    }
    return handleDashboardButton(interaction, payload, client);
  },
});

// Streamer Modal Handler
modalHandlers.set('str', {
  prefix: 'str',
  async execute(interaction, payload) {
    if (payload.includes('_wizard')) {
      return handleWizardModal(interaction, payload);
    }
    return handleDashboardModal(interaction, payload, client);
  },
});

// Streamer Role Select Handler
roleSelectHandlers.set('str', {
  prefix: 'str',
  async execute(interaction, payload) {
    if (payload.startsWith('wizard:role')) {
      return handleWizardRoleSelect(interaction, payload);
    }
    return handleDashboardRoleSelect(interaction, payload);
  },
});

// Streamer Channel Select Handler
channelSelectHandlers.set('str', {
  prefix: 'str',
  async execute(interaction, payload) {
    if (payload.startsWith('wizard:channel')) {
      return handleWizardChannelSelect(interaction, payload);
    }
    return handleDashboardChannelSelect(interaction, payload);
  },
});

// Streamer User Select Handler (neuer Typ)
userSelectHandlers.set('str', {
  prefix: 'str',
  async execute(interaction, payload) {
    return handleDashboardUserSelect(interaction, payload);
  },
});
```

Checker starten (vor `client.login`):
```typescript
setupStreamerChecker(client);
```

- [ ] **Step 2: userSelectHandlers in src/index.ts importieren**

Im Import-Block von `./client`:
```typescript
import {
  client, commands, buttonHandlers, selectMenuHandlers,
  channelSelectHandlers, roleSelectHandlers, modalHandlers,
  userSelectHandlers,   // NEU
} from './client';
```

- [ ] **Step 3: /streamer in deploy.ts hinzufügen**

```typescript
import { streamerCommand } from './commands/streamer';
// In der commands-Array ergänzen:
streamerCommand.data.toJSON(),
```

- [ ] **Step 4: Final Build**

```bash
npm run build
```

Expected: Kein Fehler. Wenn TypeScript-Fehler auftreten, die durch fehlende Imports entstehen → jeweiligen Import ergänzen.

- [ ] **Step 5: Deploy commands**

```bash
npx ts-node src/deploy.ts
```

Expected: `Commands erfolgreich registriert.` (oder ähnliche Erfolgsmeldung)

- [ ] **Step 6: PM2 neu starten**

```bash
pm2 restart scum-bot --update-env
pm2 logs scum-bot --lines 10 --nostream
```

Expected: Keine Fehler, `[streamer] 0 Live-Checker gestartet.` (0 solange keine Guilds konfiguriert sind)

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/deploy.ts
git commit -m "feat(streamer): wire all handlers into bot — streamer system complete"
```

---

## Spec-Selbstreview

**1. Spec-Coverage:**
- ✅ Wizard: 6 Konfigurationsschritte + Zusammenfassung
- ✅ Dashboard: alle 7 Buttons implementiert
- ✅ Grundeinstellungen: Rolle, Channel, Intervall, Ping-Typ
- ✅ Plattformen: Twitch ändern, YouTube ändern, YouTube deaktivieren
- ✅ Streamer: Hinzufügen, Bearbeiten, Deaktivieren, Aktivieren, Liste, Sync
- ✅ Live-Checker: per-Guild Intervall, Rolle prüfen, State Machine
- ✅ Announcements: senden + regelmäßig editieren
- ✅ Test-Nachricht
- ✅ Sicherheit: Permission-Check + Owner-Check auf jeder Interaktion
- ✅ Secrets niemals anzeigen/loggen
- ✅ Kein Bot-Crash bei API-Ausfall

**2. Placeholder-Scan:** Keine TBDs, alle Code-Blöcke vollständig.

**3. Typ-Konsistenz:**
- `sid()` wird in embeds.ts definiert und in wizard/dashboard als Import verwendet ✅
- `StreamerConfig`, `Streamer`, `StreamLiveState`, `LiveResult`, `WizardState` konsistent ✅
- `startGuildInterval(client, guildId)` — Signatur in checker.ts + dashboard.ts-Aufruf konsistent ✅
- `upsertLiveState` — Feld `announcement_message_id` vorhanden in DB + Typ ✅
