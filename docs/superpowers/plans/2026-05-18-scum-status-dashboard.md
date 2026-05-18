# SCUM Status Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent SCUM server status dashboard that posts a single embed per guild, edits it automatically on a configurable interval, and is configured via the existing `/setup` wizard.

**Architecture:** Feature module pattern matching `changelogDashboard.ts`. New SQLite table `scum_status_config`. Three feature files (service/embed/updater), one button handler (`ss` prefix), one modal handler (`scum_status` prefix), and channel select extension. All wired in `index.ts`.

**Tech Stack:** TypeScript, discord.js v14, better-sqlite3, gamedig v4

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/features/scumStatus/scumStatus.service.ts` | gamedig query logic |
| Create | `src/features/scumStatus/scumStatus.embed.ts` | status embed + modal builders |
| Create | `src/features/scumStatus/scumStatus.updater.ts` | per-guild interval loop |
| Create | `src/interactions/buttons/setup/scumStatusSetupHandler.ts` | wizard button handler (prefix `ss`) |
| Create | `src/interactions/modals/scumStatusModals.ts` | modal submit handler (prefix `scum_status`) |
| Modify | `src/db/schema.ts` | add `CREATE_SCUM_STATUS_CONFIG_TABLE` |
| Modify | `src/db/index.ts` | add 5 DB functions |
| Modify | `src/types/index.ts` | add `ScumStatusConfig` interface |
| Modify | `src/ui/brand.ts` | add `ONLINE_GREEN` and `OFFLINE_RED` colors |
| Modify | `src/services/embedService.ts` | add wizard page embed + update Step 0 button |
| Modify | `src/interactions/channelSelects/setupChannelSelectDispatcher.ts` | add `ss:channel` case |
| Modify | `src/index.ts` | register handler, modal, feature |
| Modify | `.env.example` | add SCUM status comment block |

---

## Task 1: Install gamedig

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install gamedig**

```bash
npm install gamedig
```

- [ ] **Step 2: Verify TypeScript types are included**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors about missing gamedig types (gamedig v4 ships its own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gamedig for SCUM server querying"
```

---

## Task 2: Add ScumStatusConfig type + schema constant + DB functions

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/ui/brand.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add ScumStatusConfig to src/types/index.ts**

Append at the bottom of the file (after the `ChangelogDraft` interface):

```typescript
export interface ScumStatusConfig {
  guild_id:             string;
  enabled:              number;       // 1 = aktiv, 0 = deaktiviert (SQLite INTEGER)
  channel_id:           string | null;
  message_id:           string | null;
  host:                 string | null;
  query_port:           number | null;
  update_interval_secs: number;
  created_at:           string;
  updated_at:           string;
}
```

- [ ] **Step 2: Add schema constant to src/db/schema.ts**

Append at the bottom of the file:

```typescript
export const CREATE_SCUM_STATUS_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS scum_status_config (
    guild_id              TEXT    PRIMARY KEY,
    enabled               INTEGER NOT NULL DEFAULT 1,
    channel_id            TEXT,
    message_id            TEXT,
    host                  TEXT,
    query_port            INTEGER,
    update_interval_secs  INTEGER NOT NULL DEFAULT 60,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;
```

- [ ] **Step 3: Add ONLINE_GREEN and OFFLINE_RED to src/ui/brand.ts**

Replace the `SECTOR_COLORS` export (add two entries):

```typescript
export const SECTOR_COLORS = {
  SECTOR_RED:     0x8B0000,
  BLOOD_RED:      0xB11212,
  DARK_RED:       0x4A0000,
  CHARCOAL:       0x111111,
  STEEL:          0x3A3A3A,
  ASH:            0x6B6B6B,
  WARNING_AMBER:  0xB36B00,
  MILITARY_GREEN: 0x3E5F3E,
  ONLINE_GREEN:   0x57F287,
  OFFLINE_RED:    0xED4245,
} as const;
```

- [ ] **Step 4: Add DB functions to src/db/index.ts**

First, add the import for `CREATE_SCUM_STATUS_CONFIG_TABLE` at the top of the imports from `./schema`:

```typescript
import {
  CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE,
  CREATE_GUILD_CONFIG_TABLE, CREATE_GUILD_SUPPORT_ROLES_TABLE,
  CREATE_TICKET_CATEGORY_CONFIG_TABLE, CREATE_OLDMAN_CONFIG_TABLE,
  CREATE_CHANGELOG_CONFIG_TABLE, CREATE_SCUM_STATUS_CONFIG_TABLE,
} from './schema';
```

Add `ScumStatusConfig` to the type imports:

```typescript
import type { Ticket, Panel, GuildConfig, TicketCategoryConfig, ChangelogConfig, ScumStatusConfig } from '../types';
```

Add `db.exec(CREATE_SCUM_STATUS_CONFIG_TABLE);` inside `initDb()`, after the changelog table line:

```typescript
  db.exec(CREATE_CHANGELOG_CONFIG_TABLE);
  db.exec(CREATE_SCUM_STATUS_CONFIG_TABLE);
```

Append the five DB functions at the bottom of the file:

```typescript
export function getScumStatusConfig(guildId: string): ScumStatusConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM scum_status_config WHERE guild_id = ?')
    .get(guildId) as ScumStatusConfig | undefined;
}

export function upsertScumStatusConfig(
  guildId: string,
  data: Partial<Omit<ScumStatusConfig, 'guild_id' | 'created_at' | 'updated_at'>>,
): ScumStatusConfig {
  getDb().prepare(`
    INSERT INTO scum_status_config (guild_id, enabled, channel_id, message_id, host, query_port, update_interval_secs)
    VALUES (@guild_id, COALESCE(@enabled, 0), @channel_id, @message_id, @host, @query_port, COALESCE(@update_interval_secs, 60))
    ON CONFLICT(guild_id) DO UPDATE SET
      enabled               = COALESCE(@enabled,               enabled),
      channel_id            = COALESCE(@channel_id,            channel_id),
      message_id            = COALESCE(@message_id,            message_id),
      host                  = COALESCE(@host,                  host),
      query_port            = COALESCE(@query_port,            query_port),
      update_interval_secs  = COALESCE(@update_interval_secs,  update_interval_secs),
      updated_at            = datetime('now')
  `).run({
    guild_id:             guildId,
    enabled:              data.enabled              ?? null,  // COALESCE(@enabled, 0) im SQL übernimmt Default
    channel_id:           data.channel_id           ?? null,
    message_id:           data.message_id           ?? null,
    host:                 data.host                 ?? null,
    query_port:           data.query_port           ?? null,
    update_interval_secs: data.update_interval_secs ?? null,
  });
  return getScumStatusConfig(guildId)!;
}

export function setScumStatusMessageId(guildId: string, messageId: string | null): void {
  getDb()
    .prepare(`UPDATE scum_status_config SET message_id = ?, updated_at = datetime('now') WHERE guild_id = ?`)
    .run(messageId, guildId);
}

export function setScumStatusEnabled(guildId: string, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE scum_status_config SET enabled = ?, updated_at = datetime('now') WHERE guild_id = ?`)
    .run(enabled ? 1 : 0, guildId);
}

export function getAllActiveScumStatuses(): ScumStatusConfig[] {
  return getDb()
    .prepare(`
      SELECT * FROM scum_status_config
      WHERE enabled = 1 AND host IS NOT NULL AND channel_id IS NOT NULL
    `)
    .all() as ScumStatusConfig[];
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/db/schema.ts src/db/index.ts src/ui/brand.ts
git commit -m "feat: add ScumStatusConfig type, schema, and DB functions"
```

---

## Task 3: Create scumStatus.service.ts

**Files:**
- Create: `src/features/scumStatus/scumStatus.service.ts`
- Create: `src/features/scumStatus/scumStatus.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scumStatus/scumStatus.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryServer } from './scumStatus.service';
import type { QueryResult } from './scumStatus.service';

vi.mock('gamedig', () => ({
  default: {
    query: vi.fn(),
  },
}));

import Gamedig from 'gamedig';
const mockQuery = vi.mocked(Gamedig.query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queryServer', () => {
  it('returns online result with correct fields on success', async () => {
    mockQuery.mockResolvedValueOnce({
      name: 'Sector 13 Server',
      map: '',
      password: false,
      maxplayers: 64,
      players: Array.from({ length: 12 }, () => ({ name: 'player' })),
      bots: [],
      connect: '1.2.3.4:7042',
      ping: 43,
      queryPort: 27015,
    } as any);

    const result = await queryServer('1.2.3.4', 27015);

    expect(result.online).toBe(true);
    if (result.online) {
      expect(result.players).toBe(12);
      expect(result.maxPlayers).toBe(64);
      expect(result.ping).toBe(43);
      expect(result.serverName).toBe('Sector 13 Server');
    }
  });

  it('returns offline result when query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await queryServer('1.2.3.4', 27015);

    expect(result.online).toBe(false);
  });

  it('returns offline result when query times out', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Server is offline or unreachable'));

    const result = await queryServer('1.2.3.4', 27015);

    expect(result.online).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/scumStatus/scumStatus.service.test.ts
```

Expected: FAIL — `Cannot find module './scumStatus.service'`

- [ ] **Step 3: Create src/features/scumStatus/scumStatus.service.ts**

```typescript
import Gamedig from 'gamedig';
import { logger } from '../../utils/logger';

export type QueryResult =
  | { online: true; serverName: string; players: number; maxPlayers: number; ping: number }
  | { online: false };

export async function queryServer(host: string, port: number): Promise<QueryResult> {
  try {
    const state = await Gamedig.query({
      type: 'scum',   // Fallback: 'protocol-valve' falls 'scum' nicht supportet wird
      host,
      port,
      requestRules: false,
    });
    return {
      online:     true,
      serverName: state.name,
      players:    state.players.length,
      maxPlayers: state.maxplayers,
      ping:       state.ping,
    };
  } catch (err) {
    logger.warn(`[scumStatus] Query fehlgeschlagen (${host}:${port}): ${err}`);
    return { online: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/scumStatus/scumStatus.service.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/scumStatus/scumStatus.service.ts src/features/scumStatus/scumStatus.service.test.ts
git commit -m "feat: add scumStatus.service with queryServer"
```

---

## Task 4: Create scumStatus.embed.ts

**Files:**
- Create: `src/features/scumStatus/scumStatus.embed.ts`
- Create: `src/features/scumStatus/scumStatus.embed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scumStatus/scumStatus.embed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildStatusEmbed } from './scumStatus.embed';

describe('buildStatusEmbed', () => {
  it('builds green online embed with player and ping fields', () => {
    const embed = buildStatusEmbed({
      online: true,
      serverName: 'Sector 13',
      players: 12,
      maxPlayers: 64,
      ping: 43,
    });

    const json = embed.toJSON();
    expect(json.color).toBe(0x57F287);
    expect(json.description).toContain('🟢');
    expect(json.fields?.some(f => f.name.includes('Spieler') && f.value.includes('12'))).toBe(true);
    expect(json.fields?.some(f => f.name.includes('Ping') && f.value.includes('43'))).toBe(true);
    expect(json.title).toBe('🖥️ Sector 13');
  });

  it('builds red offline embed with Nicht verfügbar fields', () => {
    const embed = buildStatusEmbed({ online: false });

    const json = embed.toJSON();
    expect(json.color).toBe(0xED4245);
    expect(json.description).toContain('🔴');
    expect(json.fields?.every(f => !f.value.includes('verfügbar') || f.value === 'Nicht verfügbar')).toBe(true);
  });

  it('includes footer text', () => {
    const embed = buildStatusEmbed({ online: false });
    expect(embed.toJSON().footer?.text).toBe('Automatisches Server-Dashboard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/scumStatus/scumStatus.embed.test.ts
```

Expected: FAIL — `Cannot find module './scumStatus.embed'`

- [ ] **Step 3: Create src/features/scumStatus/scumStatus.embed.ts**

```typescript
import {
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { SECTOR_COLORS } from '../../ui/brand';
import type { QueryResult } from './scumStatus.service';

const STATUS_TITLE   = '🖥️ Sector 13';
const STATUS_FOOTER  = 'Automatisches Server-Dashboard';

export function buildStatusEmbed(result: QueryResult): EmbedBuilder {
  const now = Math.floor(Date.now() / 1000);

  if (!result.online) {
    return new EmbedBuilder()
      .setColor(SECTOR_COLORS.OFFLINE_RED)
      .setTitle(STATUS_TITLE)
      .setDescription('🔴 Offline')
      .addFields(
        { name: '👥 Spieler',               value: 'Nicht verfügbar', inline: true },
        { name: '🏓 Ping',                  value: 'Nicht verfügbar', inline: true },
        { name: '🕐 Letzte Aktualisierung', value: `<t:${now}:R>`,   inline: false },
      )
      .setFooter({ text: STATUS_FOOTER })
      .setTimestamp();
  }

  const descriptionLines = ['🟢 Online'];
  if (result.serverName) descriptionLines.push(`\`${result.serverName}\``);

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.ONLINE_GREEN)
    .setTitle(STATUS_TITLE)
    .setDescription(descriptionLines.join('\n'))
    .addFields(
      { name: '👥 Spieler',               value: `${result.players} / ${result.maxPlayers}`, inline: true },
      { name: '🏓 Ping',                  value: `${result.ping} ms`,                        inline: true },
      { name: '🕐 Letzte Aktualisierung', value: `<t:${now}:R>`,                             inline: false },
    )
    .setFooter({ text: STATUS_FOOTER })
    .setTimestamp();
}

export function buildScumConfigModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:config')
    .setTitle('Server konfigurieren')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('host')
          .setLabel('Server-IP oder Domain')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 123.456.789.0'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query_port')
          .setLabel('Query-Port')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Standard: 27015'),
      ),
    );
}

export function buildScumIntervalModal(currentSecs: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:interval')
    .setTitle('Aktualisierungsintervall')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('interval_secs')
          .setLabel('Intervall in Sekunden (Minimum: 30)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 60')
          .setValue(String(currentSecs)),
      ),
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/scumStatus/scumStatus.embed.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/scumStatus/scumStatus.embed.ts src/features/scumStatus/scumStatus.embed.test.ts
git commit -m "feat: add scumStatus.embed with buildStatusEmbed and modal builders"
```

---

## Task 5: Create scumStatus.updater.ts

**Files:**
- Create: `src/features/scumStatus/scumStatus.updater.ts`

- [ ] **Step 1: Create src/features/scumStatus/scumStatus.updater.ts**

```typescript
import type { Client } from 'discord.js';
import {
  getScumStatusConfig, getAllActiveScumStatuses,
  setScumStatusMessageId, setScumStatusEnabled,
} from '../../db/index';
import { queryServer } from './scumStatus.service';
import { buildStatusEmbed } from './scumStatus.embed';
import { logger } from '../../utils/logger';

const MIN_INTERVAL_SECS = 30;

let _client: Client;
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function setupScumStatus(client: Client): void {
  _client = client;
  client.once('ready', async (c) => {
    _client = c;
    const configs = getAllActiveScumStatuses();
    for (const config of configs) {
      startInterval(config.guild_id);
    }
    logger.info(`[scumStatus] ${configs.length} Update-Loop(s) gestartet.`);
  });
}

export function startInterval(guildId: string): void {
  stopInterval(guildId);

  const config = getScumStatusConfig(guildId);
  if (!config?.enabled || !config.channel_id || !config.host) return;

  const secs = Math.max(config.update_interval_secs, MIN_INTERVAL_SECS);
  const ms   = secs * 1000;

  void updateDashboard(guildId);
  activeIntervals.set(guildId, setInterval(() => { void updateDashboard(guildId); }, ms));
}

export function stopInterval(guildId: string): void {
  const existing = activeIntervals.get(guildId);
  if (existing) {
    clearInterval(existing);
    activeIntervals.delete(guildId);
  }
}

async function updateDashboard(guildId: string): Promise<void> {
  const config = getScumStatusConfig(guildId);
  if (!config?.enabled || !config.channel_id || !config.host || !config.query_port) {
    stopInterval(guildId);
    return;
  }

  try {
    const channel = await _client.channels.fetch(config.channel_id).catch(() => null);

    if (!channel?.isTextBased()) {
      logger.warn(`[scumStatus] Channel nicht gefunden — Guild ${guildId}. Dashboard deaktiviert.`);
      setScumStatusEnabled(guildId, false);
      stopInterval(guildId);
      return;
    }

    const result = await queryServer(config.host, config.query_port);
    const embed  = buildStatusEmbed(result);

    let msgId = config.message_id ?? null;

    if (msgId) {
      try {
        const msg = await channel.messages.fetch(msgId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        msgId = null;
      }
    }

    const msg = await channel.send({ embeds: [embed] });
    setScumStatusMessageId(guildId, msg.id);
  } catch (err) {
    logger.error(`[scumStatus] Update-Fehler — Guild ${guildId}: ${err}`);
  }
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/scumStatus/scumStatus.updater.ts
git commit -m "feat: add scumStatus.updater with per-guild interval loop"
```

---

## Task 6: Add wizard UI to embedService.ts and update Step 0

**Files:**
- Modify: `src/services/embedService.ts`

- [ ] **Step 1: Add ScumStatusConfig import to embedService.ts**

Find the existing type import line at the top:

```typescript
import type { GuildConfig, TicketCategoryConfig, DoctorCheck, ChangelogConfig } from '../types';
```

Replace it with:

```typescript
import type { GuildConfig, TicketCategoryConfig, DoctorCheck, ChangelogConfig, ScumStatusConfig } from '../types';
```

- [ ] **Step 2: Add SCUM Status button to buildWizardStep0Components**

Find `buildWizardStep0Components()` (currently at line ~243). Replace its return value:

```typescript
export function buildWizardStep0Components(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:1').setLabel('Einrichtung starten').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:cl:home').setLabel('Changelog-System').setEmoji('🧾').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ss:home').setLabel('Server-Status').setEmoji('🖥️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:doctor').setLabel('Diagnose').setEmoji('🩺').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Schließen').setStyle(ButtonStyle.Secondary),
    ),
  ];
}
```

- [ ] **Step 3: Append SCUM Status wizard functions to embedService.ts**

Append at the bottom of the file (after `buildWizardChangelogComponents`):

```typescript
// ─── SCUM STATUS SETUP STEP ───────────────────────────────────────────────────

export function createWizardScumStatusEmbed(config: ScumStatusConfig | undefined): EmbedBuilder {
  const channelVal  = config?.channel_id           ? `<#${config.channel_id}>`            : '⬜ *nicht gesetzt*';
  const serverVal   = config?.host && config?.query_port ? `${config.host}:${config.query_port}` : '⬜ *nicht konfiguriert*';
  const intervalVal = config ? `${config.update_interval_secs} Sekunden` : '60 Sekunden';

  let statusVal = '⚪ Nicht eingerichtet';
  if (config?.enabled && config.message_id)          statusVal = '✅ Aktiv';
  else if (config?.enabled && config.host)           statusVal = '⚙️ Konfiguriert (nicht gestartet)';
  else if (config && !config.enabled)                statusVal = '⏹️ Deaktiviert';

  const isConfigured = !!(config?.channel_id && config.host);

  return new EmbedBuilder()
    .setColor(isConfigured ? SECTOR_COLORS.MILITARY_GREEN : SECTOR_COLORS.SECTOR_RED)
    .setTitle('🖥️ SCUM-Server-Status')
    .setDescription(
      'Richte das automatische Server-Status-Dashboard ein. ' +
      'Der Bot postet eine Embed-Nachricht im gewählten Channel und aktualisiert sie regelmäßig.',
    )
    .addFields(
      { name: '📡 Status-Channel',          value: channelVal,  inline: true  },
      { name: '🌐 Server',                  value: serverVal,   inline: true  },
      { name: '🕐 Aktualisierungsintervall', value: intervalVal, inline: true  },
      { name: '⚡ Status',                  value: statusVal,   inline: false },
    )
    .setFooter({ text: 'SCUM-Server-Status • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardScumStatusComponents(
  config: ScumStatusConfig | undefined,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const canCreate  = !!(config?.channel_id && config.host && config.query_port);
  const hasMessage = !!config?.message_id;
  const isEnabled  = !!(config?.enabled);

  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:ss:channel')
        .setPlaceholder('📡 Status-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ss:config')
        .setLabel('Server konfigurieren')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ss:interval')
        .setLabel('Intervall setzen')
        .setEmoji('🕐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('s:step:0')
        .setLabel('Zurück')
        .setEmoji('◀')
        .setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ss:create')
        .setLabel('Dashboard erstellen')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canCreate),
      new ButtonBuilder()
        .setCustomId('ss:recreate')
        .setLabel('Neu erstellen')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!hasMessage),
      new ButtonBuilder()
        .setCustomId('ss:disable')
        .setLabel('Deaktivieren')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isEnabled),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}
```

- [ ] **Step 4: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/embedService.ts
git commit -m "feat: add SCUM status wizard embed and update Step 0 button"
```

---

## Task 7: Create scumStatusSetupHandler.ts

**Files:**
- Create: `src/interactions/buttons/setup/scumStatusSetupHandler.ts`

- [ ] **Step 1: Create src/interactions/buttons/setup/scumStatusSetupHandler.ts**

```typescript
import { PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import {
  getScumStatusConfig, upsertScumStatusConfig,
  setScumStatusMessageId, setScumStatusEnabled,
} from '../../../db/index';
import {
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../../services/embedService';
import { buildScumConfigModal, buildScumIntervalModal, buildStatusEmbed } from '../../../features/scumStatus/scumStatus.embed';
import { startInterval, stopInterval } from '../../../features/scumStatus/scumStatus.updater';
import { isAdmin } from '../../../services/permissionService';
import { replyError } from '../../../utils/errors';
import type { ButtonHandler } from '../../../types';

export const scumStatusSetupHandler: ButtonHandler = {
  prefix: 'ss',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId   = guild.id;

    // ── Home / Wizard-Seite ────────────────────────────────────────────────────

    if (payload === 'home') {
      const config = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(config)],
        components: buildWizardScumStatusComponents(config),
      });
    }

    // ── Server konfigurieren (Modal öffnen) ────────────────────────────────────

    if (payload === 'config') {
      return interaction.showModal(buildScumConfigModal());
    }

    // ── Intervall setzen (Modal öffnen) ────────────────────────────────────────

    if (payload === 'interval') {
      const config = getScumStatusConfig(guildId);
      const current = config?.update_interval_secs ?? 60;
      return interaction.showModal(buildScumIntervalModal(current));
    }

    // ── Dashboard erstellen ────────────────────────────────────────────────────

    if (payload === 'create') {
      const config = getScumStatusConfig(guildId);

      if (!config?.channel_id || !config.host || !config.query_port) {
        return replyError(interaction, 'Bitte konfiguriere zuerst den Channel und den Server (IP + Port).');
      }

      const channel = await guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel?.isTextBased()) {
        return replyError(interaction, 'Der konfigurierte Channel wurde nicht gefunden oder ist ungültig.');
      }

      const me = guild.members.me;
      if (!me) return replyError(interaction, 'Bot-Member nicht gefunden.');

      const perms = channel.permissionsFor(me);
      const requiredPerms = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ] as const;
      const missingPerms = requiredPerms.filter(p => !perms?.has(p));

      if (missingPerms.length > 0) {
        const names = missingPerms.map(p => {
          const map: Record<string, string> = {
            [String(PermissionFlagsBits.ViewChannel)]:      'Kanal anzeigen',
            [String(PermissionFlagsBits.SendMessages)]:     'Nachrichten senden',
            [String(PermissionFlagsBits.EmbedLinks)]:       'Links einbetten',
            [String(PermissionFlagsBits.ReadMessageHistory)]: 'Nachrichtenverlauf lesen',
          };
          return map[String(p)] ?? String(p);
        });
        return replyError(interaction, `Fehlende Bot-Berechtigungen im Channel: **${names.join(', ')}**`);
      }

      await interaction.deferUpdate();

      const embed = buildStatusEmbed({ online: false });
      const msg   = await channel.send({ embeds: [embed] });

      upsertScumStatusConfig(guildId, { enabled: 1 });
      setScumStatusMessageId(guildId, msg.id);
      startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.editReply({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Dashboard neu erstellen ────────────────────────────────────────────────

    if (payload === 'recreate') {
      const config = getScumStatusConfig(guildId);

      if (!config?.channel_id || !config.host || !config.query_port) {
        return replyError(interaction, 'Bitte konfiguriere zuerst den Channel und den Server (IP + Port).');
      }

      await interaction.deferUpdate();

      // Alte Nachricht löschen (best-effort)
      if (config.message_id) {
        try {
          const ch = await guild.channels.fetch(config.channel_id).catch(() => null);
          if (ch?.isTextBased()) {
            const oldMsg = await ch.messages.fetch(config.message_id).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
          }
        } catch { /* ignorieren */ }
      }

      setScumStatusMessageId(guildId, null);
      stopInterval(guildId);
      startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.editReply({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Dashboard deaktivieren ─────────────────────────────────────────────────

    if (payload === 'disable') {
      setScumStatusEnabled(guildId, false);
      stopInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
  },
};
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/interactions/buttons/setup/scumStatusSetupHandler.ts
git commit -m "feat: add scumStatusSetupHandler (prefix ss)"
```

---

## Task 8: Create scumStatusModals.ts

**Files:**
- Create: `src/interactions/modals/scumStatusModals.ts`

- [ ] **Step 1: Create src/interactions/modals/scumStatusModals.ts**

```typescript
import type { ModalSubmitInteraction } from 'discord.js';
import { getScumStatusConfig, upsertScumStatusConfig } from '../../db/index';
import {
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../services/embedService';
import { startInterval } from '../../features/scumStatus/scumStatus.updater';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ModalHandler } from '../../types';

const MIN_INTERVAL_SECS = 30;

export const scumStatusModalHandler: ModalHandler = {
  prefix: 'scum_status',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const guildId = interaction.guildId;

    // ── Server konfigurieren (Host + Port) ─────────────────────────────────────

    if (payload === 'config') {
      const host      = interaction.fields.getTextInputValue('host').trim();
      const portRaw   = interaction.fields.getTextInputValue('query_port').trim();
      const queryPort = parseInt(portRaw, 10);

      if (!host) {
        return replyError(interaction, 'Bitte gib eine gültige Server-IP oder Domain ein.');
      }
      if (isNaN(queryPort) || queryPort < 1 || queryPort > 65535) {
        return replyError(interaction, 'Bitte gib einen gültigen Port ein (1–65535).');
      }

      upsertScumStatusConfig(guildId, { host, query_port: queryPort });

      // Intervall neu starten falls bereits aktiv
      const config = getScumStatusConfig(guildId);
      if (config?.enabled && config.channel_id) startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.reply({
        ephemeral:  true,
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Intervall setzen ────────────────────────────────────────────────────────

    if (payload === 'interval') {
      const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
      const secs = parseInt(raw, 10);

      if (isNaN(secs) || secs < 1) {
        return replyError(interaction, 'Bitte gib eine gültige Zahl in Sekunden ein.');
      }

      const clamped = Math.max(secs, MIN_INTERVAL_SECS);
      upsertScumStatusConfig(guildId, { update_interval_secs: clamped });

      // Intervall neu starten damit neue Zeitspanne aktiv wird
      const config = getScumStatusConfig(guildId);
      if (config?.enabled && config.channel_id && config.host) startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      const note    = secs < MIN_INTERVAL_SECS
        ? ` (auf Minimum ${MIN_INTERVAL_SECS}s hochgesetzt)`
        : '';

      return interaction.reply({
        ephemeral:  true,
        content:    `✅ Intervall auf **${clamped} Sekunden** gesetzt${note}.`,
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
  },
};
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/interactions/modals/scumStatusModals.ts
git commit -m "feat: add scumStatusModalHandler (prefix scum_status)"
```

---

## Task 9: Update setupChannelSelectDispatcher.ts

**Files:**
- Modify: `src/interactions/channelSelects/setupChannelSelectDispatcher.ts`

- [ ] **Step 1: Add imports to setupChannelSelectDispatcher.ts**

Add the following imports at the top (after the existing imports):

```typescript
import { getScumStatusConfig, upsertScumStatusConfig } from '../../db/index';
import { createWizardScumStatusEmbed, buildWizardScumStatusComponents } from '../../services/embedService';
import { startInterval } from '../../features/scumStatus/scumStatus.updater';
```

Note: `getChangelogConfig` and `upsertChangelogConfig` are already imported from `'../../db/index'` — merge those imports into one line:

```typescript
import {
  getConfig, upsertConfig,
  getChangelogConfig, upsertChangelogConfig,
  getScumStatusConfig, upsertScumStatusConfig,
} from '../../db/index';
```

- [ ] **Step 2: Add ss:channel case to the execute function**

In the `execute` function, append the new case before the closing `}`:

```typescript
    // SCUM Status – Status-Channel
    if (payload === 'ss:channel') {
      upsertScumStatusConfig(guildId, { channel_id: channelId });

      // Intervall neu starten falls bereits vollständig konfiguriert
      const scumConfig = getScumStatusConfig(guildId);
      if (scumConfig?.enabled && scumConfig.host && scumConfig.query_port) {
        startInterval(guildId);
      }

      const updated = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
```

- [ ] **Step 3: Also add the wizard embed/component imports to the existing import from embedService**

Find the existing embedService import block and add the two new functions:

```typescript
import {
  createWizardStep1Embed, buildWizardStep1Components,
  createWizardStep4Embed, buildWizardStep4Components,
  createWizardStep5Embed, buildWizardStep5Components,
  createWizardChangelogEmbed, buildWizardChangelogComponents,
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../services/embedService';
```

- [ ] **Step 4: Compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/channelSelects/setupChannelSelectDispatcher.ts
git commit -m "feat: add ss:channel case to setupChannelSelectDispatcher"
```

---

## Task 10: Wire up in index.ts and finalize

**Files:**
- Modify: `src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add imports to src/index.ts**

Add after the existing feature imports (after `import { setupChangelogDashboard }`):

```typescript
import { setupScumStatus } from './features/scumStatus/scumStatus.updater';
```

Add after the existing button handler imports:

```typescript
import { scumStatusSetupHandler } from './interactions/buttons/setup/scumStatusSetupHandler';
```

Add after the existing modal handler imports:

```typescript
import { scumStatusModalHandler } from './interactions/modals/scumStatusModals';
```

- [ ] **Step 2: Register scumStatusSetupHandler in the button handlers loop**

Find the button handler registration loop and add `scumStatusSetupHandler`:

```typescript
for (const handler of [
  ticketCloseHandler, ticketConfirmCloseHandler, ticketCancelCloseHandler,
  ticketClaimHandler, ticketAddPromptHandler, ticketRemovePromptHandler,
  acceptRulesHandler, setupButtonDispatcher, changelogButtonHandler,
  scumStatusSetupHandler,
]) {
  buttonHandlers.set(handler.prefix, handler);
}
```

- [ ] **Step 3: Register scumStatusModalHandler**

Find the modal handler registration and add the new handler:

```typescript
modalHandlers.set(ticketAddModalHandler.prefix,    ticketAddModalHandler);
modalHandlers.set(ticketRemoveModalHandler.prefix,  ticketRemoveModalHandler);
modalHandlers.set(setupAddCategoryModal.prefix,     setupAddCategoryModal);
modalHandlers.set(changelogModalHandler.prefix,     changelogModalHandler);
modalHandlers.set(scumStatusModalHandler.prefix,    scumStatusModalHandler);
```

- [ ] **Step 4: Register setupScumStatus feature**

Find the feature setup calls and add the new one:

```typescript
initDb(env.DATABASE_PATH);
setupOldManLore(client);
setupChangelogDashboard(client);
setupScumStatus(client);
client.login(env.DISCORD_TOKEN);
```

- [ ] **Step 5: Update .env.example**

Append the comment block at the bottom of `.env.example`:

```
# SCUM Status Dashboard
# Konfiguration erfolgt per /setup → 🖥️ Server-Status
# Host, Query-Port und Intervall werden pro Guild in der Datenbank gespeichert
```

- [ ] **Step 6: Final compile check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/index.ts .env.example
git commit -m "feat: register SCUM status handler, modal, and feature in index.ts"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npx tsc --noEmit` — no errors
- [ ] `npm test` — all tests pass
- [ ] `/setup` in Discord → `🖥️ Server-Status` button appears on home page
- [ ] Clicking the button opens SCUM status wizard page
- [ ] Selecting a channel via select menu saves and refreshes the page
- [ ] "Server konfigurieren" modal opens with host + port fields
- [ ] After entering valid host/port, wizard shows them
- [ ] "Intervall setzen" modal enforces minimum 30s
- [ ] "Dashboard erstellen" posts embed in chosen channel
- [ ] Embed is edited (not reposted) on each update tick
- [ ] After bot restart, same message is found and updated
- [ ] If the status message is deleted, a new one is created automatically
- [ ] If the channel is deleted, the dashboard is disabled without crashing
- [ ] Bot log shows `[scumStatus] N Update-Loop(s) gestartet.` on startup
