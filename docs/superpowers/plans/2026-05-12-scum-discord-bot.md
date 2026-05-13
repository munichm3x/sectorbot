# SCUM Discord Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional Discord bot for a SCUM gaming server with a ticket system, whitelist role assignment via rules acceptance, persistent SQLite storage, and elite Discord UI — all in German.

**Architecture:** Command/Interaction-Registry pattern. Commands and Handlers are loaded into registries at startup. A central dispatcher in `client.ts` routes all Interactions by `customId` prefix (`prefix:payload`). Services encapsulate business logic independently from Interaction handlers.

**Tech Stack:** TypeScript 5.x, Node.js LTS, discord.js v14, better-sqlite3, dotenv, tsx (dev runner), vitest (tests), tsc (build)

---

## File Map

| File | Responsibility |
|---|---|
| `src/types/index.ts` | Shared TypeScript interfaces |
| `src/config/constants.ts` | Ticket categories, color palette |
| `src/config/env.ts` | dotenv loader + validation |
| `src/utils/logger.ts` | Timestamped console logger |
| `src/utils/errors.ts` | `replyError` + `BotError` class |
| `src/utils/ids.ts` | customId constants, `makeId`, `parseId`, `sanitizeChannelName` |
| `src/db/schema.ts` | SQL `CREATE TABLE` strings |
| `src/db/index.ts` | DB connection + all query functions |
| `src/db/index.test.ts` | DB query unit tests (in-memory SQLite) |
| `src/services/permissionService.ts` | Permission check functions |
| `src/services/permissionService.test.ts` | Permission unit tests |
| `src/services/embedService.ts` | All EmbedBuilder factory functions |
| `src/services/logService.ts` | Log-Channel event sender |
| `src/services/ticketService.ts` | Ticket open/close/claim/add/remove logic |
| `src/services/roleService.ts` | Whitelist role assignment |
| `src/client.ts` | Discord Client + Interaction dispatcher |
| `src/index.ts` | Startup: loads env, DB, registers handlers, logs in |
| `src/deploy.ts` | Standalone script to register slash commands |
| `src/commands/setup-tickets.ts` | `/setup-tickets` command |
| `src/commands/setup-rules.ts` | `/setup-rules` command |
| `src/commands/ticket-close.ts` | `/ticket-close` command |
| `src/commands/ticket-add.ts` | `/ticket-add` command |
| `src/commands/ticket-remove.ts` | `/ticket-remove` command |
| `src/commands/ticket-rename.ts` | `/ticket-rename` command |
| `src/commands/ticket-claim.ts` | `/ticket-claim` command |
| `src/interactions/selectMenus/ticketCategory.ts` | Select Menu → create ticket |
| `src/interactions/buttons/closeTicket.ts` | 🔒 Schließen button |
| `src/interactions/buttons/confirmClose.ts` | Ja, schließen button |
| `src/interactions/buttons/cancelClose.ts` | Abbrechen button |
| `src/interactions/buttons/claimTicket.ts` | 📌 Claim button |
| `src/interactions/buttons/addUserPrompt.ts` | 👤 User hinzufügen → opens modal |
| `src/interactions/buttons/removeUserPrompt.ts` | 👤 User entfernen → opens modal |
| `src/interactions/buttons/acceptRules.ts` | ✅ Regeln akzeptieren button |
| `src/interactions/modals/ticketAddModal.ts` | Modal submit → add user |
| `src/interactions/modals/ticketRemoveModal.ts` | Modal submit → remove user |
| `README.md` | Setup guide |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create project directories**

```
mkdir src src\config src\commands src\interactions src\interactions\buttons src\interactions\selectMenus src\interactions\modals src\services src\db src\utils src\types
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "scum-discord-bot",
  "version": "1.0.0",
  "description": "Professional Discord bot for SCUM gaming server",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "deploy:commands": "tsx src/deploy.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "discord.js": "^14.16.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `.env.example`**

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
TICKET_PANEL_CHANNEL_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
RULES_CHANNEL_ID=
WHITELIST_ROLE_ID=
SUPPORT_ROLE_IDS=role_id_1,role_id_2
ADMIN_ROLE_IDS=role_id_3
DATABASE_PATH=./data/bot.db
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
data/
.env
*.js.map
```

- [ ] **Step 7: Install dependencies**

```
npm install
```

Expected output: `added X packages` — no errors.

- [ ] **Step 8: Commit**

```
git init
git add package.json tsconfig.json vitest.config.ts .env.example .gitignore
git commit -m "chore: project scaffold"
```

---

## Task 2: Shared Types & Constants

**Files:**
- Create: `src/types/index.ts`
- Create: `src/config/constants.ts`

- [ ] **Step 1: Write `src/types/index.ts`**

```typescript
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export interface Ticket {
  id: number;
  guild_id: string;
  channel_id: string;
  opener_user_id: string;
  category: string;
  status: 'open' | 'closed';
  claimed_by: string | null;
  created_at: number;
  closed_at: number | null;
}

export interface Panel {
  id: number;
  guild_id: string;
  type: 'tickets' | 'rules';
  channel_id: string;
  message_id: string;
}

export interface TicketCategory {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export interface Command {
  data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ButtonHandler {
  prefix: string;
  execute: (interaction: ButtonInteraction, payload: string) => Promise<void>;
}

export interface SelectMenuHandler {
  prefix: string;
  execute: (interaction: StringSelectMenuInteraction, payload: string) => Promise<void>;
}

export interface ModalHandler {
  prefix: string;
  execute: (interaction: ModalSubmitInteraction, payload: string) => Promise<void>;
}
```

- [ ] **Step 2: Write `src/config/constants.ts`**

```typescript
import type { TicketCategory } from '../types';

export const COLORS = {
  primary:       0x5865F2,
  success:       0x57F287,
  warning:       0xFEE75C,
  danger:        0xED4245,
  neutral:       0x2B2D31,
  premiumAccent: 0xEB459E,
} as const;

export const TICKET_CATEGORIES: TicketCategory[] = [
  { id: 'allgemein', label: 'Allgemeiner Support', description: 'Allgemeine Fragen & Hilfe',        emoji: '🔧' },
  { id: 'technisch', label: 'Technisches Problem', description: 'Bugs, Verbindungsprobleme',         emoji: '💻' },
  { id: 'report',    label: 'Report / Melden',     description: 'Spieler oder Regelverstoß melden', emoji: '🚨' },
  { id: 'whitelist', label: 'Whitelist-Frage',     description: 'Fragen zur Freischaltung',         emoji: '📋' },
  { id: 'bewerbung', label: 'Bewerbung / Team',    description: 'Bewirb dich im Team',              emoji: '📝' },
  { id: 'sonstiges', label: 'Sonstiges',           description: 'Alles andere',                     emoji: '❓' },
];
```

- [ ] **Step 3: Commit**

```
git add src/types src/config/constants.ts
git commit -m "feat: shared types and constants"
```

---

## Task 3: Config Env Loader

**Files:**
- Create: `src/config/env.ts`

- [ ] **Step 1: Write `src/config/env.ts`**

```typescript
import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

function requireEnvList(key: string): string[] {
  const raw = process.env[key];
  if (!raw) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export const env = {
  DISCORD_TOKEN:           requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:               requireEnv('CLIENT_ID'),
  GUILD_ID:                requireEnv('GUILD_ID'),
  TICKET_PANEL_CHANNEL_ID: requireEnv('TICKET_PANEL_CHANNEL_ID'),
  TICKET_CATEGORY_ID:      requireEnv('TICKET_CATEGORY_ID'),
  TICKET_LOG_CHANNEL_ID:   requireEnv('TICKET_LOG_CHANNEL_ID'),
  RULES_CHANNEL_ID:        requireEnv('RULES_CHANNEL_ID'),
  WHITELIST_ROLE_ID:       requireEnv('WHITELIST_ROLE_ID'),
  SUPPORT_ROLE_IDS:        requireEnvList('SUPPORT_ROLE_IDS'),
  ADMIN_ROLE_IDS:          requireEnvList('ADMIN_ROLE_IDS'),
  DATABASE_PATH:           process.env.DATABASE_PATH ?? './data/bot.db',
} as const;
```

- [ ] **Step 2: Copy `.env.example` to `.env` and fill in real values**

The bot will fail to start if any required variable is missing — that is intentional.

- [ ] **Step 3: Commit**

```
git add src/config/env.ts
git commit -m "feat: env loader with validation"
```

---

## Task 4: Utility Modules

**Files:**
- Create: `src/utils/logger.ts`
- Create: `src/utils/errors.ts`
- Create: `src/utils/ids.ts`

- [ ] **Step 1: Write `src/utils/logger.ts`**

```typescript
import { inspect } from 'util';

type Level = 'info' | 'warn' | 'error' | 'debug';

function format(level: Level, ...args: unknown[]): string {
  const ts = new Date().toISOString();
  const parts = args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: 3 })));
  return `[${ts}] [${level.toUpperCase()}] ${parts.join(' ')}`;
}

export const logger = {
  info:  (...args: unknown[]) => console.info(format('info',  ...args)),
  warn:  (...args: unknown[]) => console.warn(format('warn',  ...args)),
  error: (...args: unknown[]) => console.error(format('error', ...args)),
  debug: (...args: unknown[]) => console.debug(format('debug', ...args)),
};
```

- [ ] **Step 2: Write `src/utils/errors.ts`**

```typescript
import { EmbedBuilder } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { COLORS } from '../config/constants';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction;

export async function replyError(interaction: RepliableInteraction, message: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle('❌ Fehler')
    .setDescription(message);

  const payload = { embeds: [embed], ephemeral: true } as const;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export class BotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotError';
  }
}
```

- [ ] **Step 3: Write `src/utils/ids.ts`**

```typescript
export const IDS = {
  TICKET_CATEGORY:       'ticket_category',
  TICKET_CLOSE:          'ticket_close',
  TICKET_CONFIRM_CLOSE:  'ticket_confirm_close',
  TICKET_CANCEL_CLOSE:   'ticket_cancel_close',
  TICKET_CLAIM:          'ticket_claim',
  TICKET_ADD_PROMPT:     'ticket_add_prompt',
  TICKET_REMOVE_PROMPT:  'ticket_remove_prompt',
  TICKET_ADD_MODAL:      'ticket_add_modal',
  TICKET_REMOVE_MODAL:   'ticket_remove_modal',
  ACCEPT_RULES:          'accept_rules',
} as const;

export function makeId(prefix: string, payload: string): string {
  return `${prefix}:${payload}`;
}

export function parseId(customId: string): { prefix: string; payload: string } {
  const idx = customId.indexOf(':');
  if (idx === -1) return { prefix: customId, payload: '' };
  return { prefix: customId.slice(0, idx), payload: customId.slice(idx + 1) };
}

export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
```

- [ ] **Step 4: Write tests for `ids.ts`**

Create `src/utils/ids.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { makeId, parseId, sanitizeChannelName } from './ids';

describe('makeId / parseId', () => {
  it('round-trips id with payload', () => {
    const id = makeId('ticket_close', '123456789');
    const { prefix, payload } = parseId(id);
    expect(prefix).toBe('ticket_close');
    expect(payload).toBe('123456789');
  });

  it('handles id without colon', () => {
    const { prefix, payload } = parseId('accept_rules');
    expect(prefix).toBe('accept_rules');
    expect(payload).toBe('');
  });
});

describe('sanitizeChannelName', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(sanitizeChannelName('Hello World')).toBe('hello-world');
  });

  it('collapses consecutive dashes', () => {
    expect(sanitizeChannelName('a--b')).toBe('a-b');
  });

  it('removes leading and trailing dashes', () => {
    expect(sanitizeChannelName('-hello-')).toBe('hello');
  });

  it('strips non-alphanumeric characters', () => {
    expect(sanitizeChannelName('ticket_🎫_user')).toBe('ticket--user');
  });

  it('truncates to 100 characters', () => {
    expect(sanitizeChannelName('a'.repeat(200)).length).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 5: Run tests**

```
npm test
```

Expected: all `ids.test.ts` tests PASS.

- [ ] **Step 6: Commit**

```
git add src/utils
git commit -m "feat: logger, error helper, and customId utilities"
```

---

## Task 5: Database Layer

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `src/db/index.test.ts`

- [ ] **Step 1: Write `src/db/schema.ts`**

```typescript
export const CREATE_TICKETS_TABLE = `
  CREATE TABLE IF NOT EXISTS tickets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id       TEXT    NOT NULL,
    channel_id     TEXT    NOT NULL UNIQUE,
    opener_user_id TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'open',
    claimed_by     TEXT,
    created_at     INTEGER NOT NULL,
    closed_at      INTEGER
  )
`;

export const CREATE_PANELS_TABLE = `
  CREATE TABLE IF NOT EXISTS panels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    type       TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    UNIQUE(guild_id, type)
  )
`;
```

- [ ] **Step 2: Write `src/db/index.ts`**

```typescript
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE } from './schema';
import type { Ticket, Panel } from '../types';
import { logger } from '../utils/logger';

let db: Database.Database;

export function initDb(path: string): void {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_TICKETS_TABLE);
  db.exec(CREATE_PANELS_TABLE);
  if (path !== ':memory:') logger.info(`Datenbank initialisiert: ${path}`);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Datenbank nicht initialisiert. initDb() aufrufen.');
  return db;
}

export function createTicket(
  data: Omit<Ticket, 'id' | 'status' | 'claimed_by' | 'closed_at'>
): Ticket {
  const stmt = getDb().prepare(`
    INSERT INTO tickets (guild_id, channel_id, opener_user_id, category, status, created_at)
    VALUES (@guild_id, @channel_id, @opener_user_id, @category, 'open', @created_at)
  `);
  const result = stmt.run(data);
  return getTicketById(result.lastInsertRowid as number)!;
}

export function findOpenTicketByUser(guildId: string, userId: string): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE guild_id = ? AND opener_user_id = ? AND status = 'open'`)
    .get(guildId, userId) as Ticket | undefined;
}

export function findTicketByChannel(channelId: string): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE channel_id = ?`)
    .get(channelId) as Ticket | undefined;
}

export function closeTicket(channelId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?`)
    .run(Math.floor(Date.now() / 1000), channelId);
}

export function claimTicket(channelId: string, userId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET claimed_by = ? WHERE channel_id = ?`)
    .run(userId, channelId);
}

export function upsertPanel(
  guildId: string,
  type: 'tickets' | 'rules',
  channelId: string,
  messageId: string
): void {
  getDb().prepare(`
    INSERT INTO panels (guild_id, type, channel_id, message_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, type) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id
  `).run(guildId, type, channelId, messageId);
}

export function getPanel(guildId: string, type: 'tickets' | 'rules'): Panel | undefined {
  return getDb()
    .prepare(`SELECT * FROM panels WHERE guild_id = ? AND type = ?`)
    .get(guildId, type) as Panel | undefined;
}

function getTicketById(id: number): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE id = ?`)
    .get(id) as Ticket | undefined;
}
```

- [ ] **Step 3: Write `src/db/index.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb, createTicket, findOpenTicketByUser,
  findTicketByChannel, closeTicket, claimTicket,
  upsertPanel, getPanel,
} from './index';

beforeEach(() => {
  initDb(':memory:');
});

describe('tickets', () => {
  it('creates a ticket and returns it with status open', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c1',
      opener_user_id: 'u1', category: 'allgemein', created_at: 1000,
    });
    expect(ticket.status).toBe('open');
    expect(ticket.id).toBeGreaterThan(0);
  });

  it('findOpenTicketByUser returns the open ticket', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    const found = findOpenTicketByUser('g1', 'u1');
    expect(found?.channel_id).toBe('c1');
  });

  it('findOpenTicketByUser returns undefined when no open ticket', () => {
    expect(findOpenTicketByUser('g1', 'u1')).toBeUndefined();
  });

  it('findOpenTicketByUser returns undefined after ticket is closed', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    closeTicket('c1');
    expect(findOpenTicketByUser('g1', 'u1')).toBeUndefined();
  });

  it('findTicketByChannel returns ticket regardless of status', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    closeTicket('c1');
    expect(findTicketByChannel('c1')?.status).toBe('closed');
  });

  it('claimTicket sets claimed_by', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    claimTicket('c1', 'supporter1');
    expect(findTicketByChannel('c1')?.claimed_by).toBe('supporter1');
  });

  it('prevents duplicate channel_id', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    expect(() =>
      createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u2', category: 'allgemein', created_at: 2 })
    ).toThrow();
  });
});

describe('panels', () => {
  it('upserts and retrieves a panel', () => {
    upsertPanel('g1', 'tickets', 'chan1', 'msg1');
    expect(getPanel('g1', 'tickets')?.message_id).toBe('msg1');
  });

  it('updates existing panel on second upsert', () => {
    upsertPanel('g1', 'tickets', 'chan1', 'msg1');
    upsertPanel('g1', 'tickets', 'chan1', 'msg2');
    expect(getPanel('g1', 'tickets')?.message_id).toBe('msg2');
  });

  it('getPanel returns undefined for unknown guild', () => {
    expect(getPanel('unknown', 'tickets')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run tests**

```
npm test
```

Expected: all `db/index.test.ts` tests PASS.

- [ ] **Step 5: Commit**

```
git add src/db
git commit -m "feat: database layer with SQLite queries and tests"
```

---

## Task 6: Permission Service

**Files:**
- Create: `src/services/permissionService.ts`
- Create: `src/services/permissionService.test.ts`

- [ ] **Step 1: Write `src/services/permissionService.ts`**

```typescript
import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { env } from '../config/env';
import type { Ticket } from '../types';

export function isAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return env.ADMIN_ROLE_IDS.some(id => member.roles.cache.has(id));
}

export function isSupport(member: GuildMember): boolean {
  return env.SUPPORT_ROLE_IDS.some(id => member.roles.cache.has(id));
}

export function isTicketOwner(member: GuildMember, ticket: Ticket): boolean {
  return member.id === ticket.opener_user_id;
}

export function canModerateTicket(member: GuildMember, ticket: Ticket): boolean {
  return isAdmin(member) || isSupport(member) || isTicketOwner(member, ticket);
}

export function canSetup(member: GuildMember): boolean {
  if (isAdmin(member)) return true;
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}
```

- [ ] **Step 2: Write `src/services/permissionService.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { isAdmin, isSupport, isTicketOwner, canModerateTicket, canSetup } from './permissionService';
import type { GuildMember } from 'discord.js';
import type { Ticket } from '../types';

vi.mock('../config/env', () => ({
  env: {
    ADMIN_ROLE_IDS: ['admin-role'],
    SUPPORT_ROLE_IDS: ['support-role'],
  },
}));

function makeMember(opts: { permissions?: bigint; roles?: string[]; id?: string }): GuildMember {
  const perms = opts.permissions ?? 0n;
  const roles = opts.roles ?? [];
  return {
    id: opts.id ?? 'user1',
    permissions: { has: (flag: bigint) => (perms & flag) === flag },
    roles: { cache: { has: (id: string) => roles.includes(id) } },
  } as unknown as GuildMember;
}

const ticket: Ticket = {
  id: 1, guild_id: 'g', channel_id: 'c', opener_user_id: 'owner1',
  category: 'allgemein', status: 'open', claimed_by: null,
  created_at: 1, closed_at: null,
};

describe('isAdmin', () => {
  it('true for Administrator permission', () =>
    expect(isAdmin(makeMember({ permissions: PermissionFlagsBits.Administrator }))).toBe(true));
  it('true for admin role', () =>
    expect(isAdmin(makeMember({ roles: ['admin-role'] }))).toBe(true));
  it('false otherwise', () =>
    expect(isAdmin(makeMember({}))).toBe(false));
});

describe('isSupport', () => {
  it('true for support role', () =>
    expect(isSupport(makeMember({ roles: ['support-role'] }))).toBe(true));
  it('false otherwise', () =>
    expect(isSupport(makeMember({}))).toBe(false));
});

describe('isTicketOwner', () => {
  it('true when member is opener', () =>
    expect(isTicketOwner(makeMember({ id: 'owner1' }), ticket)).toBe(true));
  it('false for other users', () =>
    expect(isTicketOwner(makeMember({ id: 'other' }), ticket)).toBe(false));
});

describe('canModerateTicket', () => {
  it('allows admin', () =>
    expect(canModerateTicket(makeMember({ roles: ['admin-role'] }), ticket)).toBe(true));
  it('allows support', () =>
    expect(canModerateTicket(makeMember({ roles: ['support-role'] }), ticket)).toBe(true));
  it('allows ticket owner', () =>
    expect(canModerateTicket(makeMember({ id: 'owner1' }), ticket)).toBe(true));
  it('denies others', () =>
    expect(canModerateTicket(makeMember({ id: 'stranger' }), ticket)).toBe(false));
});

describe('canSetup', () => {
  it('allows ManageGuild permission', () =>
    expect(canSetup(makeMember({ permissions: PermissionFlagsBits.ManageGuild }))).toBe(true));
  it('allows admin role', () =>
    expect(canSetup(makeMember({ roles: ['admin-role'] }))).toBe(true));
  it('denies regular users', () =>
    expect(canSetup(makeMember({}))).toBe(false));
});
```

- [ ] **Step 3: Run tests**

```
npm test
```

Expected: all `permissionService.test.ts` tests PASS.

- [ ] **Step 4: Commit**

```
git add src/services/permissionService.ts src/services/permissionService.test.ts
git commit -m "feat: permission service with unit tests"
```

---

## Task 7: Embed Service

**Files:**
- Create: `src/services/embedService.ts`

- [ ] **Step 1: Write `src/services/embedService.ts`**

```typescript
import { EmbedBuilder } from 'discord.js';
import type { GuildMember } from 'discord.js';
import { COLORS, TICKET_CATEGORIES } from '../config/constants';

export function createTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.premiumAccent)
    .setTitle('🎫 Support Center')
    .setDescription(
      '**Willkommen im Support Center!**\n\n' +
      'Wähle unten eine Kategorie aus, um ein Ticket zu erstellen. ' +
      'Unser Support-Team meldet sich so schnell wie möglich.\n\n' +
      '**Ticket-Regeln:**\n' +
      '› Beschreibe dein Anliegen so präzise wie möglich\n' +
      '› Füge bei technischen Problemen Screenshots oder Logs bei\n' +
      '› Respektiere das Support-Team\n' +
      '› **Missbrauch des Ticket-Systems wird sanktioniert**'
    )
    .setFooter({ text: 'SCUM Support • Kategorie auswählen um zu beginnen' })
    .setTimestamp();
}

export function createTicketWelcomeEmbed(
  member: GuildMember,
  categoryId: string,
  supportRoleId?: string
): EmbedBuilder {
  const cat = TICKET_CATEGORIES.find(c => c.id === categoryId);
  const catLabel = cat ? `${cat.emoji} ${cat.label}` : categoryId;

  let desc =
    `Hallo ${member}! Danke für deine Kontaktaufnahme.\n\n` +
    `**Kategorie:** ${catLabel}\n\n` +
    '**Nächste Schritte:**\n' +
    '› Beschreibe dein Anliegen so genau wie möglich\n' +
    '› Füge Screenshots oder Logs bei, falls relevant\n' +
    '› Unser Team meldet sich so bald wie möglich\n\n';

  if (supportRoleId) {
    desc += `<@&${supportRoleId}> wurde benachrichtigt.`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎫 Neues Ticket erstellt')
    .setDescription(desc)
    .setFooter({ text: 'Nutze die Buttons unten zur Verwaltung dieses Tickets' })
    .setTimestamp();
}

export function createRulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.premiumAccent)
    .setTitle('📜 Server-Regelwerk')
    .setDescription(
      '**Bitte lies die folgenden Regeln sorgfältig durch:**\n\n' +
      '**§1 — Respektvoller Umgang**\n' +
      '› Behandle alle Spieler mit Respekt. Beleidigungen und Harassment sind verboten.\n\n' +
      '**§2 — Kein Cheating / Exploiting**\n' +
      '› Cheats, Hacks oder das Ausnutzen von Bugs führen zum permanenten Bann.\n\n' +
      '**§3 — Kommunikation**\n' +
      '› Kein Spamming, Flooding oder übermäßiges Capslock.\n\n' +
      '**§4 — Werbung**\n' +
      '› Jegliche Werbung für andere Server oder Dienste ist untersagt.\n\n' +
      '**§5 — Team-Entscheidungen**\n' +
      '› Entscheidungen des Teams sind zu respektieren. Bei Uneinigkeit → Ticket öffnen.\n\n' +
      '**§6 — Ticketsystem**\n' +
      '› Das Ticket-System ist nur für legitime Anfragen. Missbrauch wird sanktioniert.\n\n' +
      '───────────────────────────\n' +
      '*Mit dem Klick auf „Regeln akzeptieren" bestätigst du, dass du alle Regeln gelesen und verstanden hast.*'
    )
    .setFooter({ text: 'SCUM Server • Regelwerk' })
    .setTimestamp();
}

export function createCloseConfirmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('⚠️ Ticket schließen?')
    .setDescription('Möchtest du dieses Ticket wirklich schließen?\n\n**Der Channel wird danach gelöscht.**');
}

export function createLogEmbed(
  event: string,
  fields: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const colorMap: Record<string, number> = {
    'Ticket erstellt':    COLORS.success,
    'Ticket geschlossen': COLORS.danger,
    'Ticket geclaimed':   COLORS.primary,
    'User hinzugefügt':   COLORS.success,
    'User entfernt':      COLORS.warning,
    'Ticket umbenannt':   COLORS.neutral,
  };

  return new EmbedBuilder()
    .setColor(colorMap[event] ?? COLORS.neutral)
    .setTitle(`📋 ${event}`)
    .addFields(fields)
    .setTimestamp();
}

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle('❌ Fehler')
    .setDescription(message);
}

export function createSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Erfolg')
    .setDescription(message);
}
```

- [ ] **Step 2: Commit**

```
git add src/services/embedService.ts
git commit -m "feat: embed service with all embed builders"
```

---

## Task 8: Log & Role Services

**Files:**
- Create: `src/services/logService.ts`
- Create: `src/services/roleService.ts`

- [ ] **Step 1: Write `src/services/logService.ts`**

```typescript
import type { Guild } from 'discord.js';
import { env } from '../config/env';
import { createLogEmbed } from './embedService';
import { logger } from '../utils/logger';

export async function logEvent(
  guild: Guild,
  event: string,
  fields: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  try {
    const channel = await guild.channels.fetch(env.TICKET_LOG_CHANNEL_ID);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [createLogEmbed(event, fields)] });
  } catch (err) {
    logger.error('Log-Event konnte nicht gesendet werden', err);
  }
}
```

- [ ] **Step 2: Write `src/services/roleService.ts`**

```typescript
import type { GuildMember } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function assignWhitelistRole(member: GuildMember): Promise<'assigned' | 'already_has'> {
  if (member.roles.cache.has(env.WHITELIST_ROLE_ID)) {
    return 'already_has';
  }
  await member.roles.add(env.WHITELIST_ROLE_ID, 'Regelwerk akzeptiert');
  logger.info(`Whitelist-Rolle vergeben: ${member.user.tag}`);
  return 'assigned';
}
```

- [ ] **Step 3: Commit**

```
git add src/services/logService.ts src/services/roleService.ts
git commit -m "feat: log service and role service"
```

---

## Task 9: Ticket Service

**Files:**
- Create: `src/services/ticketService.ts`

- [ ] **Step 1: Write `src/services/ticketService.ts`**

```typescript
import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild,
  type GuildMember,
} from 'discord.js';
import { env } from '../config/env';
import { TICKET_CATEGORIES } from '../config/constants';
import { createTicketWelcomeEmbed } from './embedService';
import { logEvent } from './logService';
import {
  createTicket as dbCreateTicket,
  findTicketByChannel,
  closeTicket as dbCloseTicket,
  claimTicket as dbClaimTicket,
} from '../db/index';
import { makeId, sanitizeChannelName, IDS } from '../utils/ids';
import { logger } from '../utils/logger';
import type { Ticket } from '../types';

export async function openTicket(
  guild: Guild,
  member: GuildMember,
  categoryId: string
): Promise<{ ticket: Ticket; channelId: string }> {
  const cat = TICKET_CATEGORIES.find(c => c.id === categoryId);
  const channelName = sanitizeChannelName(`ticket-${categoryId}-${member.user.username}`);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: env.TICKET_CATEGORY_ID,
    topic: `Ticket von ${member.user.tag} | Kategorie: ${cat?.label ?? categoryId}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...env.SUPPORT_ROLE_IDS.map(roleId => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
      ...env.ADMIN_ROLE_IDS.map(roleId => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
    ],
  });

  const ticket = dbCreateTicket({
    guild_id: guild.id,
    channel_id: channel.id,
    opener_user_id: member.id,
    category: categoryId,
    created_at: Math.floor(Date.now() / 1000),
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLOSE, channel.id))
      .setLabel('Ticket schließen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLAIM, channel.id))
      .setLabel('Ticket claimen')
      .setEmoji('📌')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_ADD_PROMPT, channel.id))
      .setLabel('User hinzufügen')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_REMOVE_PROMPT, channel.id))
      .setLabel('User entfernen')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  );

  const welcomeEmbed = createTicketWelcomeEmbed(member, categoryId, env.SUPPORT_ROLE_IDS[0]);
  await channel.send({ embeds: [welcomeEmbed], components: [row] });

  await logEvent(guild, 'Ticket erstellt', [
    { name: 'Ersteller', value: `<@${member.id}>`, inline: true },
    { name: 'Kategorie', value: cat?.label ?? categoryId, inline: true },
    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
  ]);

  logger.info(`Ticket erstellt: ${channel.name} von ${member.user.tag}`);
  return { ticket, channelId: channel.id };
}

export async function closeTicket(
  guild: Guild,
  channelId: string,
  closedBy: GuildMember
): Promise<void> {
  const ticket = findTicketByChannel(channelId);

  await logEvent(guild, 'Ticket geschlossen', [
    { name: 'Channel', value: ticket ? `ticket-${ticket.category}` : channelId, inline: true },
    { name: 'Geschlossen von', value: `<@${closedBy.id}>`, inline: true },
    { name: 'Ersteller', value: ticket ? `<@${ticket.opener_user_id}>` : 'Unbekannt', inline: true },
  ]);

  dbCloseTicket(channelId);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) await channel.delete('Ticket geschlossen');

  logger.info(`Ticket geschlossen: ${channelId} von ${closedBy.user.tag}`);
}

export async function claimTicket(
  guild: Guild,
  channelId: string,
  claimer: GuildMember
): Promise<boolean> {
  const ticket = findTicketByChannel(channelId);
  if (!ticket || ticket.status !== 'open' || ticket.claimed_by) return false;

  dbClaimTicket(channelId, claimer.id);

  await logEvent(guild, 'Ticket geclaimed', [
    { name: 'Channel', value: `<#${channelId}>`, inline: true },
    { name: 'Geclaimed von', value: `<@${claimer.id}>`, inline: true },
  ]);

  return true;
}

export async function addUserToTicket(
  guild: Guild,
  channelId: string,
  targetUserId: string,
  addedBy: GuildMember
): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.permissionOverwrites.create(targetUserId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });

  await logEvent(guild, 'User hinzugefügt', [
    { name: 'Channel', value: `<#${channelId}>`, inline: true },
    { name: 'User', value: `<@${targetUserId}>`, inline: true },
    { name: 'Von', value: `<@${addedBy.id}>`, inline: true },
  ]);
}

export async function removeUserFromTicket(
  guild: Guild,
  channelId: string,
  targetUserId: string,
  removedBy: GuildMember
): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.permissionOverwrites.delete(targetUserId);

  await logEvent(guild, 'User entfernt', [
    { name: 'Channel', value: `<#${channelId}>`, inline: true },
    { name: 'User', value: `<@${targetUserId}>`, inline: true },
    { name: 'Von', value: `<@${removedBy.id}>`, inline: true },
  ]);
}
```

- [ ] **Step 2: Commit**

```
git add src/services/ticketService.ts
git commit -m "feat: ticket service (open, close, claim, add/remove user)"
```

---

## Task 10: Client & Registry

**Files:**
- Create: `src/client.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Write `src/client.ts`**

```typescript
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { Command, ButtonHandler, SelectMenuHandler, ModalHandler } from './types';
import { parseId } from './utils/ids';
import { replyError } from './utils/errors';
import { logger } from './utils/logger';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

export const commands = new Collection<string, Command>();
export const buttonHandlers = new Map<string, ButtonHandler>();
export const selectMenuHandlers = new Map<string, SelectMenuHandler>();
export const modalHandlers = new Map<string, ModalHandler>();

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = buttonHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = selectMenuHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isModalSubmit()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = modalHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }
  } catch (err) {
    logger.error('Interaction-Fehler', err);
    if (interaction.isRepliable()) {
      await replyError(
        interaction as Parameters<typeof replyError>[0],
        'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'
      ).catch(() => void 0);
    }
  }
});
```

- [ ] **Step 2: Write `src/index.ts`**

```typescript
import { env } from './config/env';
import { initDb } from './db/index';
import { logger } from './utils/logger';
import { IDS } from './utils/ids';
import { client, commands, buttonHandlers, selectMenuHandlers, modalHandlers } from './client';

// Commands
import { setupTicketsCommand } from './commands/setup-tickets';
import { setupRulesCommand } from './commands/setup-rules';
import { ticketCloseCommand } from './commands/ticket-close';
import { ticketAddCommand } from './commands/ticket-add';
import { ticketRemoveCommand } from './commands/ticket-remove';
import { ticketRenameCommand } from './commands/ticket-rename';
import { ticketClaimCommand } from './commands/ticket-claim';

// Select Menus
import { ticketCategoryHandler } from './interactions/selectMenus/ticketCategory';

// Buttons
import { ticketCloseHandler } from './interactions/buttons/closeTicket';
import { ticketConfirmCloseHandler } from './interactions/buttons/confirmClose';
import { ticketCancelCloseHandler } from './interactions/buttons/cancelClose';
import { ticketClaimHandler } from './interactions/buttons/claimTicket';
import { ticketAddPromptHandler } from './interactions/buttons/addUserPrompt';
import { ticketRemovePromptHandler } from './interactions/buttons/removeUserPrompt';
import { acceptRulesHandler } from './interactions/buttons/acceptRules';

// Modals
import { ticketAddModalHandler } from './interactions/modals/ticketAddModal';
import { ticketRemoveModalHandler } from './interactions/modals/ticketRemoveModal';

// Register commands
for (const cmd of [
  setupTicketsCommand, setupRulesCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand,
]) {
  commands.set(cmd.data.name, cmd);
}

// Register select menus
selectMenuHandlers.set(ticketCategoryHandler.prefix, ticketCategoryHandler);

// Register buttons
for (const handler of [
  ticketCloseHandler, ticketConfirmCloseHandler, ticketCancelCloseHandler,
  ticketClaimHandler, ticketAddPromptHandler, ticketRemovePromptHandler,
  acceptRulesHandler,
]) {
  buttonHandlers.set(handler.prefix, handler);
}

// Register modals
modalHandlers.set(ticketAddModalHandler.prefix, ticketAddModalHandler);
modalHandlers.set(ticketRemoveModalHandler.prefix, ticketRemoveModalHandler);

client.once('ready', (c) => {
  logger.info(`Bot online: ${c.user.tag} (${c.user.id})`);
  logger.info(`Commands registriert: ${commands.size}`);
  logger.info(`Button-Handler registriert: ${buttonHandlers.size}`);
});

initDb(env.DATABASE_PATH);
client.login(env.DISCORD_TOKEN);
```

- [ ] **Step 3: Commit**

```
git add src/client.ts src/index.ts
git commit -m "feat: client registry and startup entrypoint"
```

---

## Task 11: Setup Commands

**Files:**
- Create: `src/commands/setup-tickets.ts`
- Create: `src/commands/setup-rules.ts`

- [ ] **Step 1: Write `src/commands/setup-tickets.ts`**

```typescript
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { env } from '../config/env';
import { TICKET_CATEGORIES } from '../config/constants';
import { canSetup } from '../services/permissionService';
import { createTicketPanelEmbed } from '../services/embedService';
import { upsertPanel, getPanel } from '../db/index';
import { IDS } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const setupTicketsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Erstellt oder aktualisiert das Ticket-Panel'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!canSetup(interaction.member)) {
      return replyError(interaction, 'Du benötigst die Berechtigung **Server verwalten** für diesen Command.');
    }

    await interaction.deferReply({ ephemeral: true });

    const channelId = env.TICKET_PANEL_CHANNEL_ID;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      return replyError(interaction, `Channel <#${channelId}> wurde nicht gefunden oder ist kein Text-Channel.`);
    }

    const embed = createTicketPanelEmbed();
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(IDS.TICKET_CATEGORY)
        .setPlaceholder('📂 Kategorie auswählen...')
        .addOptions(
          TICKET_CATEGORIES.map(cat =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setDescription(cat.description)
              .setValue(cat.id)
              .setEmoji(cat.emoji)
          )
        )
    );

    const existing = getPanel(interaction.guild.id, 'tickets');
    if (existing && existing.channel_id === channelId) {
      try {
        const msg = await channel.messages.fetch(existing.message_id);
        await msg.edit({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: '✅ Ticket-Panel wurde aktualisiert.' });
        return;
      } catch {
        // Nachricht existiert nicht mehr — neue erstellen
      }
    }

    const msg = await channel.send({ embeds: [embed], components: [row] });
    upsertPanel(interaction.guild.id, 'tickets', channelId, msg.id);
    await interaction.editReply({ content: `✅ Ticket-Panel wurde in <#${channelId}> erstellt.` });
  },
};
```

- [ ] **Step 2: Write `src/commands/setup-rules.ts`**

```typescript
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { env } from '../config/env';
import { canSetup } from '../services/permissionService';
import { createRulesEmbed } from '../services/embedService';
import { upsertPanel, getPanel } from '../db/index';
import { IDS } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const setupRulesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-rules')
    .setDescription('Erstellt oder aktualisiert das Regelwerk'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!canSetup(interaction.member)) {
      return replyError(interaction, 'Du benötigst die Berechtigung **Server verwalten** für diesen Command.');
    }

    await interaction.deferReply({ ephemeral: true });

    const channelId = env.RULES_CHANNEL_ID;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      return replyError(interaction, `Channel <#${channelId}> wurde nicht gefunden oder ist kein Text-Channel.`);
    }

    const embed = createRulesEmbed();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.ACCEPT_RULES)
        .setLabel('Regeln akzeptieren')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

    const existing = getPanel(interaction.guild.id, 'rules');
    if (existing && existing.channel_id === channelId) {
      try {
        const msg = await channel.messages.fetch(existing.message_id);
        await msg.edit({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: '✅ Regelwerk wurde aktualisiert.' });
        return;
      } catch {
        // Nachricht existiert nicht mehr — neue erstellen
      }
    }

    const msg = await channel.send({ embeds: [embed], components: [row] });
    upsertPanel(interaction.guild.id, 'rules', channelId, msg.id);
    await interaction.editReply({ content: `✅ Regelwerk wurde in <#${channelId}> erstellt.` });
  },
};
```

- [ ] **Step 3: Commit**

```
git add src/commands/setup-tickets.ts src/commands/setup-rules.ts
git commit -m "feat: /setup-tickets and /setup-rules commands"
```

---

## Task 12: Ticket Moderation Commands

**Files:**
- Create: `src/commands/ticket-close.ts`
- Create: `src/commands/ticket-add.ts`
- Create: `src/commands/ticket-remove.ts`
- Create: `src/commands/ticket-rename.ts`
- Create: `src/commands/ticket-claim.ts`

- [ ] **Step 1: Write `src/commands/ticket-close.ts`**

```typescript
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { createCloseConfirmEmbed } from '../services/embedService';
import { makeId, IDS } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketCloseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Schließt das aktuelle Ticket'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) {
      return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    }
    if (!canModerateTicket(interaction.member, ticket)) {
      return replyError(interaction, 'Du hast keine Berechtigung, dieses Ticket zu schließen.');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CONFIRM_CLOSE, interaction.channelId))
        .setLabel('Ja, schließen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CANCEL_CLOSE, interaction.channelId))
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [createCloseConfirmEmbed()], components: [row], ephemeral: true });
  },
};
```

- [ ] **Step 2: Write `src/commands/ticket-add.ts`**

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { addUserToTicket } from '../services/ticketService';
import { createSuccessEmbed } from '../services/embedService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Fügt einen User zum Ticket hinzu')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Der hinzuzufügende User').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');

    const target = interaction.options.getUser('user', true);
    await addUserToTicket(interaction.guild, interaction.channelId, target.id, interaction.member);

    await interaction.reply({
      embeds: [createSuccessEmbed(`<@${target.id}> wurde zum Ticket hinzugefügt.`)],
      ephemeral: true,
    });
  },
};
```

- [ ] **Step 3: Write `src/commands/ticket-remove.ts`**

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { removeUserFromTicket } from '../services/ticketService';
import { createSuccessEmbed } from '../services/embedService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketRemoveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('Entfernt einen User aus dem Ticket')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Der zu entfernende User').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');

    const target = interaction.options.getUser('user', true);
    await removeUserFromTicket(interaction.guild, interaction.channelId, target.id, interaction.member);

    await interaction.reply({
      embeds: [createSuccessEmbed(`<@${target.id}> wurde aus dem Ticket entfernt.`)],
      ephemeral: true,
    });
  },
};
```

- [ ] **Step 4: Write `src/commands/ticket-rename.ts`**

```typescript
import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { createSuccessEmbed } from '../services/embedService';
import { logEvent } from '../services/logService';
import { sanitizeChannelName } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketRenameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Benennt den Ticket-Channel um')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Neuer Name').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');

    const rawName = interaction.options.getString('name', true);
    const newName = sanitizeChannelName(`ticket-${rawName}`);

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const oldName = channel.name;
    await channel.setName(newName, `Umbenannt von ${interaction.user.tag}`);

    await logEvent(interaction.guild, 'Ticket umbenannt', [
      { name: 'Alter Name', value: oldName, inline: true },
      { name: 'Neuer Name', value: newName, inline: true },
      { name: 'Von', value: `<@${interaction.member.id}>`, inline: true },
    ]);

    await interaction.reply({
      embeds: [createSuccessEmbed(`Channel wurde zu \`${newName}\` umbenannt.`)],
      ephemeral: true,
    });
  },
};
```

- [ ] **Step 5: Write `src/commands/ticket-claim.ts`**

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { isSupport, isAdmin } from '../services/permissionService';
import { claimTicket } from '../services/ticketService';
import { createSuccessEmbed, createErrorEmbed } from '../services/embedService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketClaimCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-claim')
    .setDescription('Übernimmt dieses Ticket'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!isSupport(interaction.member) && !isAdmin(interaction.member)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Tickets claimen.');
    }

    if (ticket.claimed_by) {
      return interaction.reply({
        embeds: [createErrorEmbed(`Bereits geclaimed von <@${ticket.claimed_by}>.`)],
        ephemeral: true,
      });
    }

    const success = await claimTicket(interaction.guild, interaction.channelId, interaction.member);
    if (!success) return replyError(interaction, 'Claim fehlgeschlagen.');

    await interaction.reply({
      embeds: [createSuccessEmbed(`<@${interaction.member.id}> hat dieses Ticket übernommen. 📌`)],
    });
  },
};
```

- [ ] **Step 6: Commit**

```
git add src/commands
git commit -m "feat: ticket moderation commands (close, add, remove, rename, claim)"
```

---

## Task 13: Select Menu Interaction

**Files:**
- Create: `src/interactions/selectMenus/ticketCategory.ts`

- [ ] **Step 1: Write `src/interactions/selectMenus/ticketCategory.ts`**

```typescript
import type { StringSelectMenuInteraction } from 'discord.js';
import { findOpenTicketByUser } from '../../db/index';
import { openTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { SelectMenuHandler } from '../../types';

export const ticketCategoryHandler: SelectMenuHandler = {
  prefix: IDS.TICKET_CATEGORY,

  async execute(interaction: StringSelectMenuInteraction, _payload: string) {
    if (!interaction.inCachedGuild()) return;

    const categoryId = interaction.values[0];
    if (!categoryId) return;

    await interaction.deferReply({ ephemeral: true });

    const existing = findOpenTicketByUser(interaction.guild.id, interaction.member.id);
    if (existing) {
      await interaction.editReply({
        content: `❌ Du hast bereits ein offenes Ticket: <#${existing.channel_id}>\nBitte schließe es zuerst.`,
      });
      return;
    }

    try {
      const { channelId } = await openTicket(interaction.guild, interaction.member, categoryId);
      await interaction.editReply({
        content: `✅ Dein Ticket wurde erstellt: <#${channelId}>`,
      });
    } catch (err) {
      await replyError(interaction, 'Das Ticket konnte nicht erstellt werden. Bitte wende dich an einen Admin.');
    }
  },
};
```

- [ ] **Step 2: Commit**

```
git add src/interactions/selectMenus
git commit -m "feat: ticket category select menu handler"
```

---

## Task 14: Button Handlers

**Files:**
- Create: `src/interactions/buttons/closeTicket.ts`
- Create: `src/interactions/buttons/confirmClose.ts`
- Create: `src/interactions/buttons/cancelClose.ts`
- Create: `src/interactions/buttons/claimTicket.ts`
- Create: `src/interactions/buttons/addUserPrompt.ts`
- Create: `src/interactions/buttons/removeUserPrompt.ts`
- Create: `src/interactions/buttons/acceptRules.ts`

- [ ] **Step 1: Write `src/interactions/buttons/closeTicket.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { createCloseConfirmEmbed } from '../../services/embedService';
import { makeId, IDS } from '../../utils/ids';
import { replyError } from '../../utils/errors';
import type { ButtonHandler } from '../../types';

export const ticketCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CLOSE,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket)) {
      return replyError(interaction, 'Du hast keine Berechtigung, dieses Ticket zu schließen.');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CONFIRM_CLOSE, channelId))
        .setLabel('Ja, schließen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(makeId(IDS.TICKET_CANCEL_CLOSE, channelId))
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [createCloseConfirmEmbed()],
      components: [row],
      ephemeral: true,
    });
  },
};
```

- [ ] **Step 2: Write `src/interactions/buttons/confirmClose.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { closeTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketConfirmCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CONFIRM_CLOSE,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    await interaction.update({ content: '🔒 Ticket wird geschlossen...', embeds: [], components: [] });
    await closeTicket(interaction.guild, channelId, interaction.member);
  },
};
```

- [ ] **Step 3: Write `src/interactions/buttons/cancelClose.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketCancelCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CANCEL_CLOSE,

  async execute(interaction: ButtonInteraction, _payload: string) {
    await interaction.update({ content: '↩️ Schließen abgebrochen.', embeds: [], components: [] });
  },
};
```

- [ ] **Step 4: Write `src/interactions/buttons/claimTicket.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { isSupport, isAdmin } from '../../services/permissionService';
import { claimTicket } from '../../services/ticketService';
import { createSuccessEmbed, createErrorEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketClaimHandler: ButtonHandler = {
  prefix: IDS.TICKET_CLAIM,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!isSupport(interaction.member) && !isAdmin(interaction.member)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Tickets claimen.');
    }
    if (ticket.claimed_by) {
      return interaction.reply({
        embeds: [createErrorEmbed(`Bereits geclaimed von <@${ticket.claimed_by}>.`)],
        ephemeral: true,
      });
    }

    const success = await claimTicket(interaction.guild, channelId, interaction.member);
    if (!success) return replyError(interaction, 'Claim fehlgeschlagen.');

    await interaction.reply({
      embeds: [createSuccessEmbed(`<@${interaction.member.id}> hat dieses Ticket übernommen. 📌`)],
    });
  },
};
```

- [ ] **Step 5: Write `src/interactions/buttons/addUserPrompt.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { makeId, IDS } from '../../utils/ids';
import { replyError } from '../../utils/errors';
import type { ButtonHandler } from '../../types';

export const ticketAddPromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_ADD_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_ADD_MODAL, channelId))
      .setTitle('User zum Ticket hinzufügen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('Discord User-ID')
            .setPlaceholder('z.B. 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  },
};
```

- [ ] **Step 6: Write `src/interactions/buttons/removeUserPrompt.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { makeId, IDS } from '../../utils/ids';
import { replyError } from '../../utils/errors';
import type { ButtonHandler } from '../../types';

export const ticketRemovePromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_REMOVE_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_REMOVE_MODAL, channelId))
      .setTitle('User aus Ticket entfernen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('Discord User-ID')
            .setPlaceholder('z.B. 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  },
};
```

- [ ] **Step 7: Write `src/interactions/buttons/acceptRules.ts`**

```typescript
import type { ButtonInteraction } from 'discord.js';
import { assignWhitelistRole } from '../../services/roleService';
import { createSuccessEmbed, createErrorEmbed } from '../../services/embedService';
import { logger } from '../../utils/logger';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const acceptRulesHandler: ButtonHandler = {
  prefix: IDS.ACCEPT_RULES,

  async execute(interaction: ButtonInteraction, _payload: string) {
    if (!interaction.inCachedGuild()) return;

    try {
      const result = await assignWhitelistRole(interaction.member);

      if (result === 'already_has') {
        return interaction.reply({
          embeds: [createSuccessEmbed('Du bist bereits freigeschaltet. Viel Spaß auf dem Server!')],
          ephemeral: true,
        });
      }

      await interaction.reply({
        embeds: [createSuccessEmbed(
          '✅ Du hast die Regeln akzeptiert und wurdest freigeschaltet.\nViel Spaß auf dem Server!'
        )],
        ephemeral: true,
      });
    } catch (err: unknown) {
      logger.error('Whitelist-Rolle konnte nicht vergeben werden', err);
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.reply({
        embeds: [createErrorEmbed(
          `Die Rolle konnte nicht vergeben werden: ${msg}\n\nBitte kontaktiere einen Admin.`
        )],
        ephemeral: true,
      });
    }
  },
};
```

- [ ] **Step 8: Commit**

```
git add src/interactions/buttons
git commit -m "feat: all button interaction handlers"
```

---

## Task 15: Modal Handlers

**Files:**
- Create: `src/interactions/modals/ticketAddModal.ts`
- Create: `src/interactions/modals/ticketRemoveModal.ts`

- [ ] **Step 1: Write `src/interactions/modals/ticketAddModal.ts`**

```typescript
import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { addUserToTicket } from '../../services/ticketService';
import { createSuccessEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketAddModalHandler: ModalHandler = {
  prefix: IDS.TICKET_ADD_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Ungültige User-ID. Bitte gib eine numerische Discord-ID ein (17–20 Stellen).');
    }

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');

    try {
      await addUserToTicket(interaction.guild, channelId, userId, interaction.member);
      await interaction.reply({
        embeds: [createSuccessEmbed(`<@${userId}> wurde zum Ticket hinzugefügt.`)],
        ephemeral: true,
      });
    } catch {
      await replyError(interaction, 'User konnte nicht hinzugefügt werden. Bitte überprüfe die ID.');
    }
  },
};
```

- [ ] **Step 2: Write `src/interactions/modals/ticketRemoveModal.ts`**

```typescript
import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { removeUserFromTicket } from '../../services/ticketService';
import { createSuccessEmbed } from '../../services/embedService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketRemoveModalHandler: ModalHandler = {
  prefix: IDS.TICKET_REMOVE_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Ungültige User-ID. Bitte gib eine numerische Discord-ID ein (17–20 Stellen).');
    }

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');

    try {
      await removeUserFromTicket(interaction.guild, channelId, userId, interaction.member);
      await interaction.reply({
        embeds: [createSuccessEmbed(`<@${userId}> wurde aus dem Ticket entfernt.`)],
        ephemeral: true,
      });
    } catch {
      await replyError(interaction, 'User konnte nicht entfernt werden.');
    }
  },
};
```

- [ ] **Step 3: Commit**

```
git add src/interactions/modals
git commit -m "feat: modal handlers for user add/remove"
```

---

## Task 16: Deploy Script

**Files:**
- Create: `src/deploy.ts`

- [ ] **Step 1: Write `src/deploy.ts`**

```typescript
import { REST, Routes } from 'discord.js';
import { env } from './config/env';
import { setupTicketsCommand } from './commands/setup-tickets';
import { setupRulesCommand } from './commands/setup-rules';
import { ticketCloseCommand } from './commands/ticket-close';
import { ticketAddCommand } from './commands/ticket-add';
import { ticketRemoveCommand } from './commands/ticket-remove';
import { ticketRenameCommand } from './commands/ticket-rename';
import { ticketClaimCommand } from './commands/ticket-claim';
import { logger } from './utils/logger';

const commandList = [
  setupTicketsCommand, setupRulesCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand,
];

const rest = new REST().setToken(env.DISCORD_TOKEN);

(async () => {
  logger.info(`Registriere ${commandList.length} Slash Commands...`);
  const data = await rest.put(
    Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
    { body: commandList.map(c => c.data.toJSON()) },
  ) as unknown[];
  logger.info(`${data.length} Commands erfolgreich registriert.`);
})().catch(err => {
  logger.error('Command-Deployment fehlgeschlagen', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```
git add src/deploy.ts
git commit -m "feat: slash command deploy script"
```

---

## Task 17: Build & Test

- [ ] **Step 1: Run all tests**

```
npm test
```

Expected output: all test suites pass with no failures.

- [ ] **Step 2: Run TypeScript build**

```
npm run build
```

Expected output: `dist/` folder created, no TypeScript errors.

- [ ] **Step 3: Fix any TypeScript errors**

Common issues and fixes:
- `SlashCommandOptionsOnlyBuilder` type mismatch → ensure `types/index.ts` uses the correct union type
- Missing `null` checks on `interaction.guild` → use `interaction.inCachedGuild()` guard
- `better-sqlite3` types → ensure `@types/better-sqlite3` is installed

- [ ] **Step 4: Verify bot starts (with a valid `.env`)**

```
npm run dev
```

Expected: `[INFO] Bot online: BotName#1234` in console.

- [ ] **Step 5: Deploy commands to Discord**

```
npm run deploy:commands
```

Expected: `X Commands erfolgreich registriert.`

- [ ] **Step 6: Final commit**

```
git add dist
git commit -m "chore: verify build passes"
```

---

## Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# SCUM Discord Bot

Professioneller Discord-Bot für SCUM-Gaming-Server mit Ticket-System und Whitelist-Rollenvergabe.

## Voraussetzungen

- Node.js 20+ (LTS)
- npm 9+
- Ein Discord-Server mit Administrator-Rechten

## Bot im Discord Developer Portal erstellen

1. Gehe zu [discord.com/developers/applications](https://discord.com/developers/applications)
2. Klicke „New Application" → gib einen Namen ein
3. Wechsle zu **Bot** → klicke „Add Bot"
4. Kopiere den **Token** (für `DISCORD_TOKEN`)
5. Kopiere die **Application ID** (für `CLIENT_ID`)
6. Aktiviere unter **Privileged Gateway Intents**:
   - `SERVER MEMBERS INTENT` ✅
   - `MESSAGE CONTENT INTENT` ✅ (optional, nur für zukünftige Features)

## Bot einladen

Ersetze `CLIENT_ID` in dieser URL und öffne sie im Browser:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Permission `8` = Administrator. Alternativ minimal: `ManageChannels + ManageRoles + SendMessages + EmbedLinks + ReadMessageHistory`.

## Installation

```bash
git clone <repo-url>
cd scum-discord-bot
npm install
cp .env.example .env
```

## .env ausfüllen

Öffne `.env` und fülle alle Felder aus:

| Variable | Beschreibung | Wie finden |
|---|---|---|
| `DISCORD_TOKEN` | Bot-Token | Developer Portal → Bot |
| `CLIENT_ID` | Application ID | Developer Portal → General |
| `GUILD_ID` | Server-ID | Discord → Rechtsklick auf Server → ID kopieren |
| `TICKET_PANEL_CHANNEL_ID` | Channel für das Ticket-Panel | Rechtsklick auf Channel → ID kopieren |
| `TICKET_CATEGORY_ID` | Kategorie für neue Ticket-Channels | Rechtsklick auf Kategorie → ID kopieren |
| `TICKET_LOG_CHANNEL_ID` | Channel für Log-Nachrichten | Rechtsklick auf Channel → ID kopieren |
| `RULES_CHANNEL_ID` | Channel für das Regelwerk | Rechtsklick auf Channel → ID kopieren |
| `WHITELIST_ROLE_ID` | Rolle, die bei Regelakzeptanz vergeben wird | Server-Einstellungen → Rollen → Rechtsklick → ID |
| `SUPPORT_ROLE_IDS` | Kommagetrennte Rollen-IDs des Support-Teams | Wie oben, mehrere mit Komma trennen |
| `ADMIN_ROLE_IDS` | Kommagetrennte Admin-Rollen-IDs | Wie oben |
| `DATABASE_PATH` | Pfad zur SQLite-Datei (optional) | Standard: `./data/bot.db` |

**Tipp:** Um IDs in Discord zu sehen, aktiviere unter Einstellungen → Erweitert → **Entwicklermodus**.

## Commands deployen

```bash
npm run deploy:commands
```

Nur einmal nötig (oder nach Änderungen an Commands).

## Bot starten

**Entwicklung:**
```bash
npm run dev
```

**Produktion:**
```bash
npm run build
npm start
```

## Ticket-Panel einrichten

1. Gehe in einen Admin-Channel
2. Führe `/setup-tickets` aus
3. Das Panel erscheint im konfigurierten `TICKET_PANEL_CHANNEL_ID`

## Regelwerk einrichten

1. Gehe in einen Admin-Channel
2. Führe `/setup-rules` aus
3. Das Regelwerk erscheint im konfigurierten `RULES_CHANNEL_ID`

## Troubleshooting

### „Missing Access" beim Ticket-erstellen
→ Der Bot hat keine Berechtigung, in der Ticket-Kategorie (`TICKET_CATEGORY_ID`) Channels zu erstellen.  
→ Prüfe, ob der Bot in der Kategorie `ManageChannels` hat.

### „Missing Permissions" beim Rollenvergeben
→ Die Bot-Rolle muss in der Rollenliste **über** der Whitelist-Rolle stehen.  
→ Server-Einstellungen → Rollen → Bot-Rolle nach oben ziehen.

### Rolle wird nicht vergeben
→ `WHITELIST_ROLE_ID` ist leer oder falsch.  
→ Developer-Modus aktivieren und Rollen-ID erneut kopieren.

### Buttons / Select Menus reagieren nicht nach Neustart
→ Der Bot verwendet kein Collector-System — Buttons funktionieren permanent über customId-Routing.  
→ Stelle sicher, dass der Bot läuft. Falls nicht, mit `npm run dev` oder `npm start` starten.

### Commands erscheinen nicht in Discord
→ `npm run deploy:commands` ausführen.  
→ Commands erscheinen als Guild-Commands sofort; globale Commands können bis zu 1 Stunde dauern.

### TypeScript-Fehler beim Build
→ `npm install` erneut ausführen, um alle Typen zu installieren.  
→ Node.js-Version prüfen: `node --version` → muss 20+ sein.

### Bot kommt nicht online
→ `DISCORD_TOKEN` prüfen — kein Leerzeichen, kompletter Token.  
→ Im Developer Portal unter Bot sicherstellen, dass der Token nicht zurückgesetzt wurde.
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: comprehensive README with setup guide and troubleshooting"
```

---

## Abnahme-Checkliste

- [ ] `npm test` — alle Tests grün
- [ ] `npm run build` — keine TypeScript-Fehler
- [ ] `npm run deploy:commands` — Commands registriert
- [ ] Bot startet ohne Fehler
- [ ] `/setup-tickets` erstellt Panel mit Select Menu
- [ ] Kategorie auswählen → privater Channel wird erstellt
- [ ] @everyone kann Ticket-Channel nicht sehen
- [ ] Zweites Ticket öffnen → ephemeral Hinweis auf bestehendes
- [ ] Ticket schließen → Bestätigung → Channel gelöscht → Log erhalten
- [ ] `/setup-rules` erstellt Regelwerk
- [ ] „Regeln akzeptieren" → Whitelist-Rolle vergeben → ephemeral Bestätigung
- [ ] Bot neu starten → Buttons/Select Menus funktionieren weiterhin
```
