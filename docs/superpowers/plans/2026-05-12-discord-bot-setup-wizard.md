# Discord Bot Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all guild-specific `.env` fields with SQLite storage and implement a Discord-native setup wizard via `/setup`, `/config`, and `/doctor` slash commands.

**Architecture:** Big Bang — remove all guild-specific env vars, add 3 new SQLite tables, expose an interactive wizard via ephemeral messages using ChannelSelectMenu and RoleSelectMenu Discord components. All setup interactions share prefix `s` routed through central dispatchers.

**Tech Stack:** discord.js v14.16, better-sqlite3, TypeScript 5, Vitest

---

## File Map

**Modified:**
- `src/db/schema.ts` — 3 new CREATE TABLE statements
- `src/db/index.ts` — 7 new query functions + init new tables
- `src/types/index.ts` — add GuildConfig, GuildSupportRole, TicketCategoryConfig, DoctorCheck, ChannelSelectMenuHandler, RoleSelectMenuHandler
- `src/config/env.ts` — remove 8 guild-specific fields
- `src/config/constants.ts` — remove TICKET_CATEGORIES export
- `src/services/permissionService.ts` — isAdmin perms-only; isSupport(guildId); canSetup removed
- `src/services/ticketService.ts` — read from guildConfigService instead of env + constants
- `src/services/logService.ts` — read log channel from DB
- `src/services/roleService.ts` — read whitelist role from DB; throw BotError if missing
- `src/services/embedService.ts` — add 9 new setup embed/component functions
- `src/utils/errors.ts` — add ChannelSelectMenuInteraction + RoleSelectMenuInteraction to RepliableInteraction
- `src/client.ts` — add channelSelectHandlers + roleSelectHandlers maps + 2 new interaction branches
- `src/index.ts` — register new commands/handlers, remove old
- `src/deploy.ts` — global commands (no GUILD_ID), updated command list
- `src/interactions/buttons/closeTicket.ts` — add guildId to canModerateTicket
- `src/interactions/buttons/confirmClose.ts` — add guildId to canModerateTicket
- `src/interactions/buttons/addUserPrompt.ts` — add guildId to canModerateTicket
- `src/interactions/buttons/removeUserPrompt.ts` — add guildId to canModerateTicket
- `src/interactions/buttons/claimTicket.ts` — add guildId to isSupport
- `src/interactions/buttons/acceptRules.ts` — surface BotError message to user
- `src/interactions/selectMenus/ticketCategory.ts` — use DB categories; surface BotError
- `src/commands/ticket-close.ts` — add guildId to canModerateTicket
- `src/commands/ticket-add.ts` — add guildId to canModerateTicket
- `src/commands/ticket-rename.ts` — add guildId to canModerateTicket
- `src/commands/ticket-claim.ts` — add guildId to isSupport
- `src/services/permissionService.test.ts` — rewrite for new API
- `README.md` — new setup docs

**Created:**
- `src/services/guildConfigService.ts`
- `src/interactions/buttons/setup/setupDispatcher.ts`
- `src/interactions/channelSelects/setupChannelSelectDispatcher.ts`
- `src/interactions/roleSelects/setupRoleSelectDispatcher.ts`
- `src/interactions/modals/setupAddCategoryModal.ts`
- `src/commands/setup.ts`
- `src/commands/config.ts`
- `src/commands/doctor.ts`
- `src/services/guildConfigService.test.ts`

**Deleted:**
- `src/commands/setup-tickets.ts`
- `src/commands/setup-rules.ts`

---

### Task 1: Extend DB schema with 3 new tables

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add CREATE TABLE statements to schema.ts**

Replace entire file:

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

export const CREATE_GUILD_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id                TEXT PRIMARY KEY,
    ticket_panel_channel_id TEXT,
    ticket_category_id      TEXT,
    ticket_log_channel_id   TEXT,
    rules_channel_id        TEXT,
    whitelist_role_id       TEXT,
    ticket_panel_message_id TEXT,
    rules_message_id        TEXT,
    setup_completed         INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
  )
`;

export const CREATE_GUILD_SUPPORT_ROLES_TABLE = `
  CREATE TABLE IF NOT EXISTS guild_support_roles (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id  TEXT NOT NULL,
    UNIQUE(guild_id, role_id)
  )
`;

export const CREATE_TICKET_CATEGORY_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS ticket_category_config (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    UNIQUE(guild_id, key)
  )
`;
```

- [ ] **Step 2: Add new query functions to db/index.ts**

Add the following imports and functions to the existing file:

```typescript
// Add to imports at top:
import {
  CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE,
  CREATE_GUILD_CONFIG_TABLE, CREATE_GUILD_SUPPORT_ROLES_TABLE, CREATE_TICKET_CATEGORY_CONFIG_TABLE,
} from './schema';
import type { Ticket, Panel, GuildConfig, GuildSupportRole, TicketCategoryConfig } from '../types';

// Update initDb — add after existing db.exec calls:
db.exec(CREATE_GUILD_CONFIG_TABLE);
db.exec(CREATE_GUILD_SUPPORT_ROLES_TABLE);
db.exec(CREATE_TICKET_CATEGORY_CONFIG_TABLE);

// Add these new exported functions:

export function getGuildConfig(guildId: string): GuildConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM guild_config WHERE guild_id = ?')
    .get(guildId) as GuildConfig | undefined;
}

export function upsertGuildConfig(
  guildId: string,
  data: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>
): GuildConfig {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO guild_config (
      guild_id, ticket_panel_channel_id, ticket_category_id,
      ticket_log_channel_id, rules_channel_id, whitelist_role_id,
      ticket_panel_message_id, rules_message_id, setup_completed,
      created_at, updated_at
    ) VALUES (
      @guild_id, @ticket_panel_channel_id, @ticket_category_id,
      @ticket_log_channel_id, @rules_channel_id, @whitelist_role_id,
      @ticket_panel_message_id, @rules_message_id, @setup_completed,
      @now, @now
    ) ON CONFLICT(guild_id) DO UPDATE SET
      ticket_panel_channel_id = COALESCE(@ticket_panel_channel_id, ticket_panel_channel_id),
      ticket_category_id      = COALESCE(@ticket_category_id, ticket_category_id),
      ticket_log_channel_id   = COALESCE(@ticket_log_channel_id, ticket_log_channel_id),
      rules_channel_id        = COALESCE(@rules_channel_id, rules_channel_id),
      whitelist_role_id       = COALESCE(@whitelist_role_id, whitelist_role_id),
      ticket_panel_message_id = COALESCE(@ticket_panel_message_id, ticket_panel_message_id),
      rules_message_id        = COALESCE(@rules_message_id, rules_message_id),
      setup_completed         = COALESCE(@setup_completed, setup_completed),
      updated_at              = @now
  `).run({
    guild_id:                guildId,
    ticket_panel_channel_id: data.ticket_panel_channel_id ?? null,
    ticket_category_id:      data.ticket_category_id ?? null,
    ticket_log_channel_id:   data.ticket_log_channel_id ?? null,
    rules_channel_id:        data.rules_channel_id ?? null,
    whitelist_role_id:       data.whitelist_role_id ?? null,
    ticket_panel_message_id: data.ticket_panel_message_id ?? null,
    rules_message_id:        data.rules_message_id ?? null,
    setup_completed:         data.setup_completed ?? null,
    now,
  });
  return getGuildConfig(guildId)!;
}

export function getGuildSupportRoles(guildId: string): string[] {
  const rows = getDb()
    .prepare('SELECT role_id FROM guild_support_roles WHERE guild_id = ?')
    .all(guildId) as { role_id: string }[];
  return rows.map(r => r.role_id);
}

export function setGuildSupportRoles(guildId: string, roleIds: string[]): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM guild_support_roles WHERE guild_id = ?').run(guildId);
    const stmt = db.prepare('INSERT OR IGNORE INTO guild_support_roles (guild_id, role_id) VALUES (?, ?)');
    for (const roleId of roleIds) stmt.run(guildId, roleId);
  })();
}

export function getTicketCategoryConfigs(guildId: string): TicketCategoryConfig[] {
  return getDb()
    .prepare('SELECT * FROM ticket_category_config WHERE guild_id = ? AND enabled = 1 ORDER BY sort_order')
    .all(guildId) as TicketCategoryConfig[];
}

export function getAllTicketCategoryConfigs(guildId: string): TicketCategoryConfig[] {
  return getDb()
    .prepare('SELECT * FROM ticket_category_config WHERE guild_id = ? ORDER BY sort_order')
    .all(guildId) as TicketCategoryConfig[];
}

export function upsertTicketCategoryConfig(data: Omit<TicketCategoryConfig, 'id'>): void {
  getDb().prepare(`
    INSERT INTO ticket_category_config (guild_id, key, label, description, emoji, sort_order, enabled)
    VALUES (@guild_id, @key, @label, @description, @emoji, @sort_order, @enabled)
    ON CONFLICT(guild_id, key) DO UPDATE SET
      label       = @label,
      description = @description,
      emoji       = @emoji,
      sort_order  = @sort_order,
      enabled     = @enabled
  `).run(data);
}

export function deleteTicketCategoryConfig(guildId: string, key: string): void {
  getDb()
    .prepare('DELETE FROM ticket_category_config WHERE guild_id = ? AND key = ?')
    .run(guildId, key);
}
```

- [ ] **Step 3: Verify existing tests still pass**

```
npm test
```

Expected: all existing tests pass (new functions not yet tested, schema changes are additive).

- [ ] **Step 4: Commit**

```
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: add guild_config, guild_support_roles, ticket_category_config tables"
```

---

### Task 2: Add TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace types/index.ts with full new version**

```typescript
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
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

export interface GuildConfig {
  guild_id: string;
  ticket_panel_channel_id: string | null;
  ticket_category_id: string | null;
  ticket_log_channel_id: string | null;
  rules_channel_id: string | null;
  whitelist_role_id: string | null;
  ticket_panel_message_id: string | null;
  rules_message_id: string | null;
  setup_completed: number;
  created_at: number;
  updated_at: number;
}

export interface GuildSupportRole {
  id: number;
  guild_id: string;
  role_id: string;
}

export interface TicketCategoryConfig {
  id: number;
  guild_id: string;
  key: string;
  label: string;
  description: string;
  emoji: string;
  sort_order: number;
  enabled: number;
}

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

export interface Command {
  data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export interface ButtonHandler {
  prefix: string;
  execute: (interaction: ButtonInteraction, payload: string) => Promise<unknown>;
}

export interface SelectMenuHandler {
  prefix: string;
  execute: (interaction: StringSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface ChannelSelectMenuHandler {
  prefix: string;
  execute: (interaction: ChannelSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface RoleSelectMenuHandler {
  prefix: string;
  execute: (interaction: RoleSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface ModalHandler {
  prefix: string;
  execute: (interaction: ModalSubmitInteraction, payload: string) => Promise<unknown>;
}
```

- [ ] **Step 2: Verify build**

```
npx tsc --noEmit
```

Expected: only errors from files that still import removed env fields (expected at this stage).

- [ ] **Step 3: Commit**

```
git add src/types/index.ts
git commit -m "feat: add GuildConfig, TicketCategoryConfig, DoctorCheck, new handler types"
```

---

### Task 3: Create guildConfigService.ts

**Files:**
- Create: `src/services/guildConfigService.ts`

- [ ] **Step 1: Write the service**

```typescript
import {
  getGuildConfig, upsertGuildConfig,
  getGuildSupportRoles, setGuildSupportRoles,
  getTicketCategoryConfigs, getAllTicketCategoryConfigs,
  upsertTicketCategoryConfig, deleteTicketCategoryConfig,
} from '../db/index';
import type { GuildConfig, TicketCategoryConfig } from '../types';

const DEFAULT_CATEGORIES: Omit<TicketCategoryConfig, 'id' | 'guild_id'>[] = [
  { key: 'allgemein', label: 'Allgemeiner Support', description: 'Allgemeine Fragen & Hilfe',        emoji: '🔧', sort_order: 0, enabled: 1 },
  { key: 'technisch', label: 'Technisches Problem', description: 'Bugs, Verbindungsprobleme',         emoji: '💻', sort_order: 1, enabled: 1 },
  { key: 'report',    label: 'Report / Melden',     description: 'Spieler oder Regelverstoß melden', emoji: '🚨', sort_order: 2, enabled: 1 },
  { key: 'whitelist', label: 'Whitelist-Frage',     description: 'Fragen zur Freischaltung',         emoji: '📋', sort_order: 3, enabled: 1 },
  { key: 'bewerbung', label: 'Bewerbung / Team',    description: 'Bewirb dich im Team',              emoji: '📝', sort_order: 4, enabled: 1 },
  { key: 'sonstiges', label: 'Sonstiges',           description: 'Alles andere',                     emoji: '❓', sort_order: 5, enabled: 1 },
];

export function getConfig(guildId: string): GuildConfig | undefined {
  return getGuildConfig(guildId);
}

export function upsertConfig(
  guildId: string,
  data: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>
): GuildConfig {
  return upsertGuildConfig(guildId, data);
}

export function getSupportRoles(guildId: string): string[] {
  return getGuildSupportRoles(guildId);
}

export function setSupportRoles(guildId: string, roleIds: string[]): void {
  setGuildSupportRoles(guildId, roleIds);
}

export function getTicketCategories(guildId: string): TicketCategoryConfig[] {
  return getTicketCategoryConfigs(guildId);
}

export function getAllCategories(guildId: string): TicketCategoryConfig[] {
  return getAllTicketCategoryConfigs(guildId);
}

export function upsertCategory(guildId: string, data: Omit<TicketCategoryConfig, 'id'>): void {
  upsertTicketCategoryConfig(data);
}

export function deleteCategory(guildId: string, key: string): void {
  deleteTicketCategoryConfig(guildId, key);
}

export function seedDefaultCategories(guildId: string): void {
  const existing = getAllTicketCategoryConfigs(guildId);
  if (existing.length > 0) return;
  for (const cat of DEFAULT_CATEGORIES) {
    upsertTicketCategoryConfig({ ...cat, guild_id: guildId });
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/services/guildConfigService.ts
git commit -m "feat: add guildConfigService wrapping all guild config DB operations"
```

---

### Task 4: Simplify env.ts

**Files:**
- Modify: `src/config/env.ts`

- [ ] **Step 1: Replace env.ts**

```typescript
import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

export const env = {
  DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:     requireEnv('CLIENT_ID'),
  DATABASE_PATH: process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:      process.env.NODE_ENV ?? 'development',
} as const;
```

- [ ] **Step 2: Update .env.example**

If the file exists, replace with:
```
DISCORD_TOKEN=
CLIENT_ID=
DATABASE_PATH=./data/bot.db
NODE_ENV=development
```

- [ ] **Step 3: Commit**

```
git add src/config/env.ts
git commit -m "feat: remove guild-specific env vars — config now lives in DB"
```

---

### Task 5: Refactor permissionService + update all callers

**Files:**
- Modify: `src/services/permissionService.ts`
- Modify: `src/interactions/buttons/closeTicket.ts`
- Modify: `src/interactions/buttons/confirmClose.ts`
- Modify: `src/interactions/buttons/addUserPrompt.ts`
- Modify: `src/interactions/buttons/removeUserPrompt.ts`
- Modify: `src/interactions/buttons/claimTicket.ts`
- Modify: `src/commands/ticket-close.ts`
- Modify: `src/commands/ticket-add.ts`
- Modify: `src/commands/ticket-rename.ts`
- Modify: `src/commands/ticket-claim.ts`

- [ ] **Step 1: Rewrite permissionService.ts**

```typescript
import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { getSupportRoles } from './guildConfigService';
import type { Ticket } from '../types';

export function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export function isSupport(member: GuildMember, guildId: string): boolean {
  return getSupportRoles(guildId).some(id => member.roles.cache.has(id));
}

export function isTicketOwner(member: GuildMember, ticket: Ticket): boolean {
  return member.id === ticket.opener_user_id;
}

export function canModerateTicket(member: GuildMember, ticket: Ticket, guildId: string): boolean {
  return isAdmin(member) || isSupport(member, guildId) || isTicketOwner(member, ticket);
}
```

- [ ] **Step 2: Update closeTicket.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) {
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
```

- [ ] **Step 3: Update confirmClose.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) {
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
```

- [ ] **Step 4: Update addUserPrompt.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');
```

- [ ] **Step 5: Update removeUserPrompt.ts**

Same change as Step 4.

- [ ] **Step 6: Update claimTicket.ts**

Change line:
```typescript
    if (!isSupport(interaction.member) && !isAdmin(interaction.member)) {
```
To:
```typescript
    if (!isSupport(interaction.member, interaction.guildId) && !isAdmin(interaction.member)) {
```

- [ ] **Step 7: Update ticket-close.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) {
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
```

- [ ] **Step 8: Update ticket-add.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');
```

- [ ] **Step 9: Update ticket-rename.ts**

Change line:
```typescript
    if (!canModerateTicket(interaction.member, ticket)) return replyError(interaction, 'Keine Berechtigung.');
```
To:
```typescript
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');
```

- [ ] **Step 10: Update ticket-claim.ts**

Change line:
```typescript
    if (!isSupport(interaction.member) && !isAdmin(interaction.member)) {
```
To:
```typescript
    if (!isSupport(interaction.member, interaction.guildId) && !isAdmin(interaction.member)) {
```

- [ ] **Step 11: Verify build**

```
npx tsc --noEmit
```

Expected: no errors from permissionService or its callers.

- [ ] **Step 12: Commit**

```
git add src/services/permissionService.ts src/interactions/buttons/closeTicket.ts src/interactions/buttons/confirmClose.ts src/interactions/buttons/addUserPrompt.ts src/interactions/buttons/removeUserPrompt.ts src/interactions/buttons/claimTicket.ts src/commands/ticket-close.ts src/commands/ticket-add.ts src/commands/ticket-rename.ts src/commands/ticket-claim.ts
git commit -m "refactor: permissionService uses discord perms + DB roles; remove env dependency"
```

---

### Task 6: Refactor ticketService, logService, roleService, acceptRules, ticketCategory

**Files:**
- Modify: `src/services/ticketService.ts`
- Modify: `src/services/logService.ts`
- Modify: `src/services/roleService.ts`
- Modify: `src/interactions/buttons/acceptRules.ts`
- Modify: `src/interactions/selectMenus/ticketCategory.ts`
- Modify: `src/config/constants.ts`
- Modify: `src/services/embedService.ts` (just the createTicketWelcomeEmbed signature)

- [ ] **Step 1: Update constants.ts — remove TICKET_CATEGORIES**

```typescript
export const COLORS = {
  primary:       0x5865F2,
  success:       0x57F287,
  warning:       0xFEE75C,
  danger:        0xED4245,
  neutral:       0x2B2D31,
  premiumAccent: 0xEB459E,
} as const;
```

- [ ] **Step 2: Update createTicketWelcomeEmbed signature in embedService.ts**

Change the function signature from `(member, categoryId, supportRoleId?)` to `(member, catLabel, supportRoleId?)`:

```typescript
export function createTicketWelcomeEmbed(
  member: GuildMember,
  catLabel: string,
  supportRoleId?: string
): EmbedBuilder {
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
```

Also remove the `TICKET_CATEGORIES` import from embedService.ts (the import line currently reads `import { COLORS, TICKET_CATEGORIES } from '../config/constants';` — change to `import { COLORS } from '../config/constants';`).

- [ ] **Step 3: Rewrite ticketService.ts**

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
import { getConfig, getSupportRoles, getTicketCategories } from './guildConfigService';
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
import { BotError } from '../utils/errors';
import type { Ticket } from '../types';

export async function openTicket(
  guild: Guild,
  member: GuildMember,
  categoryKey: string
): Promise<{ ticket: Ticket; channelId: string }> {
  const config = getConfig(guild.id);
  if (!config?.ticket_category_id) {
    throw new BotError('Das Ticket-System ist nicht konfiguriert. Bitte führe /setup durch.');
  }

  const categories = getTicketCategories(guild.id);
  const cat = categories.find(c => c.key === categoryKey);
  const catLabel = cat ? `${cat.emoji} ${cat.label}` : categoryKey;
  const channelName = sanitizeChannelName(`ticket-${categoryKey}-${member.user.username}`);
  const supportRoles = getSupportRoles(guild.id);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.ticket_category_id,
    topic: `Ticket von ${member.user.tag} | Kategorie: ${catLabel}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...supportRoles.map(roleId => ({
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
    category: categoryKey,
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

  const welcomeEmbed = createTicketWelcomeEmbed(member, catLabel, supportRoles[0]);
  await channel.send({ embeds: [welcomeEmbed], components: [row] });

  await logEvent(guild, 'Ticket erstellt', [
    { name: 'Ersteller', value: `<@${member.id}>`, inline: true },
    { name: 'Kategorie', value: catLabel, inline: true },
    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
  ]);

  logger.info(`Ticket erstellt: ${channel.name} von ${member.user.tag}`);
  return { ticket, channelId: channel.id };
}

export async function closeTicket(guild: Guild, channelId: string, closedBy: GuildMember): Promise<void> {
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

export async function claimTicket(guild: Guild, channelId: string, claimer: GuildMember): Promise<boolean> {
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
  guild: Guild, channelId: string, targetUserId: string, addedBy: GuildMember
): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.permissionOverwrites.create(targetUserId, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  });

  await logEvent(guild, 'User hinzugefügt', [
    { name: 'Channel', value: `<#${channelId}>`, inline: true },
    { name: 'User', value: `<@${targetUserId}>`, inline: true },
    { name: 'Von', value: `<@${addedBy.id}>`, inline: true },
  ]);
}

export async function removeUserFromTicket(
  guild: Guild, channelId: string, targetUserId: string, removedBy: GuildMember
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

- [ ] **Step 4: Rewrite logService.ts**

```typescript
import type { Guild } from 'discord.js';
import { getConfig } from './guildConfigService';
import { createLogEmbed } from './embedService';
import { logger } from '../utils/logger';

export async function logEvent(
  guild: Guild,
  event: string,
  fields: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  try {
    const logChannelId = getConfig(guild.id)?.ticket_log_channel_id;
    if (!logChannelId) return;
    const channel = await guild.channels.fetch(logChannelId);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [createLogEmbed(event, fields)] });
  } catch (err) {
    logger.error('Log-Event konnte nicht gesendet werden', err);
  }
}
```

- [ ] **Step 5: Rewrite roleService.ts**

```typescript
import type { GuildMember } from 'discord.js';
import { getConfig } from './guildConfigService';
import { logger } from '../utils/logger';
import { BotError } from '../utils/errors';

export async function assignWhitelistRole(member: GuildMember): Promise<'assigned' | 'already_has'> {
  const roleId = getConfig(member.guild.id)?.whitelist_role_id;
  if (!roleId) {
    throw new BotError('Die Whitelist-Rolle ist nicht konfiguriert. Bitte wende dich an einen Admin (/setup).');
  }
  if (member.roles.cache.has(roleId)) {
    return 'already_has';
  }
  await member.roles.add(roleId, 'Regelwerk akzeptiert');
  logger.info(`Whitelist-Rolle vergeben: ${member.user.tag}`);
  return 'assigned';
}
```

- [ ] **Step 6: Update acceptRules.ts — surface BotError message**

Replace the catch block in `acceptRules.ts`:

```typescript
    } catch (err: unknown) {
      logger.error('Whitelist-Rolle konnte nicht vergeben werden', err);
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.reply({
        embeds: [createErrorEmbed(msg)],
        ephemeral: true,
      });
    }
```

- [ ] **Step 7: Rewrite ticketCategory.ts select menu handler**

```typescript
import type { StringSelectMenuInteraction } from 'discord.js';
import { findOpenTicketByUser } from '../../db/index';
import { getTicketCategories, seedDefaultCategories } from '../../services/guildConfigService';
import { openTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { BotError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { SelectMenuHandler } from '../../types';

export const ticketCategoryHandler: SelectMenuHandler = {
  prefix: IDS.TICKET_CATEGORY,

  async execute(interaction: StringSelectMenuInteraction, _payload: string) {
    if (!interaction.inCachedGuild()) return;

    const categoryKey = interaction.values[0];
    if (!categoryKey) return;

    await interaction.deferReply({ ephemeral: true });

    const existing = findOpenTicketByUser(interaction.guild.id, interaction.member.id);
    if (existing) {
      await interaction.editReply({
        content: `❌ Du hast bereits ein offenes Ticket: <#${existing.channel_id}>\nBitte schließe es zuerst.`,
      });
      return;
    }

    try {
      const { channelId } = await openTicket(interaction.guild, interaction.member, categoryKey);
      await interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: <#${channelId}>` });
    } catch (err) {
      const msg = err instanceof BotError ? err.message : 'Das Ticket konnte nicht erstellt werden. Bitte wende dich an einen Admin.';
      await interaction.editReply({ content: `❌ ${msg}` });
    }
  },
};
```

- [ ] **Step 8: Verify build**

```
npx tsc --noEmit
```

Expected: no errors in the modified service files.

- [ ] **Step 9: Commit**

```
git add src/services/ticketService.ts src/services/logService.ts src/services/roleService.ts src/services/embedService.ts src/config/constants.ts src/interactions/buttons/acceptRules.ts src/interactions/selectMenus/ticketCategory.ts
git commit -m "refactor: services read guild config from DB instead of env"
```

---

### Task 7: Extend client.ts and errors.ts for new interaction types

**Files:**
- Modify: `src/utils/errors.ts`
- Modify: `src/client.ts`

- [ ] **Step 1: Update errors.ts RepliableInteraction**

```typescript
import { EmbedBuilder } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { COLORS } from '../config/constants';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | RoleSelectMenuInteraction
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

- [ ] **Step 2: Rewrite client.ts**

```typescript
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type {
  Command, ButtonHandler, SelectMenuHandler,
  ChannelSelectMenuHandler, RoleSelectMenuHandler, ModalHandler,
} from './types';
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
export const channelSelectHandlers = new Map<string, ChannelSelectMenuHandler>();
export const roleSelectHandlers = new Map<string, RoleSelectMenuHandler>();
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

    if (interaction.isChannelSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = channelSelectHandlers.get(prefix);
      if (!handler) return;
      await handler.execute(interaction, payload);
      return;
    }

    if (interaction.isRoleSelectMenu()) {
      const { prefix, payload } = parseId(interaction.customId);
      const handler = roleSelectHandlers.get(prefix);
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

- [ ] **Step 3: Commit**

```
git add src/utils/errors.ts src/client.ts
git commit -m "feat: add ChannelSelectMenu + RoleSelectMenu dispatcher branches to client"
```

---

### Task 8: Add setup embed + component builder functions to embedService.ts

**Files:**
- Modify: `src/services/embedService.ts`

- [ ] **Step 1: Add new imports to embedService.ts**

At the top, change the imports to:

```typescript
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { COLORS } from '../config/constants';
import type { GuildConfig, TicketCategoryConfig, DoctorCheck } from '../types';
import { IDS } from '../utils/ids';
```

- [ ] **Step 2: Add 9 new functions at the end of embedService.ts**

```typescript
export function createSetupHomeEmbed(config: GuildConfig | undefined, guild: Guild): EmbedBuilder {
  const ticketOk = !!(config?.ticket_panel_channel_id && config?.ticket_category_id);
  const panelPublished = !!config?.ticket_panel_message_id;
  const rulesOk = !!(config?.rules_channel_id && config?.whitelist_role_id);
  const rulesPublished = !!config?.rules_message_id;
  const isCompleted = config?.setup_completed === 1;

  const steps = [
    { label: 'Ticket-System konfiguriert', done: ticketOk },
    { label: 'Panel veröffentlicht', done: panelPublished },
    { label: 'Regelwerk konfiguriert', done: rulesOk },
    { label: 'Regelwerk veröffentlicht', done: rulesPublished },
  ];
  const doneCount = steps.filter(s => s.done).length;

  return new EmbedBuilder()
    .setColor(isCompleted ? COLORS.success : COLORS.primary)
    .setTitle('⚙️ Setup Center')
    .setDescription(
      `**${guild.name}**\n\n` +
      steps.map(s => `${s.done ? '✅' : '⬜'} ${s.label}`).join('\n') +
      `\n\n*${doneCount}/4 Schritte abgeschlossen*` +
      (isCompleted ? '\n\n✅ **Setup abgeschlossen!**' : '')
    )
    .setTimestamp();
}

export function buildHomeComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:ticket').setLabel('Ticket-System').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:rules').setLabel('Regelwerk').setEmoji('📜').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:doctor').setLabel('Diagnose').setEmoji('🩺').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:complete').setLabel('Abschließen').setEmoji('✅').setStyle(ButtonStyle.Success),
    ),
  ];
}

export function createTicketSetupEmbed(config: GuildConfig, supportRoles: string[], guild: Guild): EmbedBuilder {
  const panelCh  = config.ticket_panel_channel_id ? `<#${config.ticket_panel_channel_id}>` : '*nicht gesetzt*';
  const ticketCat = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '*nicht gesetzt*';
  const logCh    = config.ticket_log_channel_id ? `<#${config.ticket_log_channel_id}>` : '*nicht gesetzt (optional)*';
  const rolesStr = supportRoles.length > 0 ? supportRoles.map(r => `<@&${r}>`).join(' ') : '*keine gesetzt*';
  const panelMsg = config.ticket_panel_message_id ? '✅ Veröffentlicht' : '⬜ Noch nicht veröffentlicht';

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎫 Ticket-System konfigurieren')
    .setDescription(
      `**Panel-Channel:** ${panelCh}\n` +
      `**Ticket-Kategorie:** ${ticketCat}\n` +
      `**Log-Channel:** ${logCh}\n` +
      `**Support-Rollen:** ${rolesStr}\n` +
      `**Panel-Status:** ${panelMsg}\n\n` +
      '*Verwende die Menüs unten, um die Werte zu setzen.*'
    )
    .setTimestamp();
}

export function buildTicketSetupComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:t:panel')
        .setPlaceholder('📢 Panel-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:t:cat')
        .setPlaceholder('📁 Ticket-Kategorie (Discord-Kategorie) auswählen...')
        .setChannelTypes(ChannelType.GuildCategory)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:t:log')
        .setPlaceholder('📋 Log-Channel auswählen (optional)...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('s:t:supp')
        .setPlaceholder('👥 Support-Rollen auswählen...')
        .setMinValues(1)
        .setMaxValues(10)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:t:pub').setLabel('Panel veröffentlichen').setEmoji('📤').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('s:t:cats').setLabel('Kategorien').setEmoji('📦').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:home').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

export function createRulesSetupEmbed(config: GuildConfig, guild: Guild): EmbedBuilder {
  const rulesCh = config.rules_channel_id ? `<#${config.rules_channel_id}>` : '*nicht gesetzt*';
  const wlRole  = config.whitelist_role_id ? `<@&${config.whitelist_role_id}>` : '*nicht gesetzt*';
  const rulesMsg = config.rules_message_id ? '✅ Veröffentlicht' : '⬜ Noch nicht veröffentlicht';

  return new EmbedBuilder()
    .setColor(COLORS.premiumAccent)
    .setTitle('📜 Regelwerk konfigurieren')
    .setDescription(
      `**Regelwerk-Channel:** ${rulesCh}\n` +
      `**Whitelist-Rolle:** ${wlRole}\n` +
      `**Regelwerk-Status:** ${rulesMsg}\n\n` +
      '*Verwende die Menüs unten, um die Werte zu setzen.*'
    )
    .setTimestamp();
}

export function buildRulesSetupComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:r:ch')
        .setPlaceholder('📢 Regelwerk-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('s:r:role')
        .setPlaceholder('🎖 Whitelist-Rolle auswählen...')
        .setMaxValues(1)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:r:pub').setLabel('Regelwerk veröffentlichen').setEmoji('📤').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('s:home').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

export function createManageCategoriesEmbed(categories: TicketCategoryConfig[]): EmbedBuilder {
  const list = categories.length === 0
    ? '*Keine Kategorien konfiguriert.*'
    : categories.map((c, i) => `**${i + 1}.** ${c.emoji} **${c.label}** (\`${c.key}\`) ${c.enabled ? '✅' : '❌'}`).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle('📦 Ticket-Kategorien verwalten')
    .setDescription(`${list}\n\nVerwende die Buttons unten, um Kategorien hinzuzufügen oder zu löschen.`)
    .setTimestamp();
}

export function buildManageCategoriesComponents(categories: TicketCategoryConfig[]): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  // Up to 3 rows of 5 delete buttons (15 categories max displayed)
  const chunks: TicketCategoryConfig[][] = [];
  for (let i = 0; i < Math.min(categories.length, 15); i += 5) {
    chunks.push(categories.slice(i, i + 5));
  }
  for (const chunk of chunks) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...chunk.map(cat =>
        new ButtonBuilder()
          .setCustomId(`s:t:cat:del:${cat.key}`)
          .setLabel(`🗑 ${cat.label.slice(0, 20)}`)
          .setStyle(ButtonStyle.Danger)
      )
    );
    rows.push(row as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);
  }

  // Final row: Add + Back
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('s:t:cat:add').setLabel('Kategorie hinzufügen').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('s:ticket').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
  );
  rows.push(actionRow as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);

  return rows;
}

export function createAdminPanelEmbed(
  config: GuildConfig,
  supportRoles: string[],
  categories: TicketCategoryConfig[],
  guild: Guild
): EmbedBuilder {
  const f = (v: string | null) => v ? `<#${v}>` : '*nicht gesetzt*';
  const r = (v: string | null) => v ? `<@&${v}>` : '*nicht gesetzt*';

  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle('🔧 Admin Control Panel')
    .setDescription(`**${guild.name}** — Aktuelle Konfiguration`)
    .addFields(
      { name: 'Panel-Channel',     value: f(config.ticket_panel_channel_id), inline: true },
      { name: 'Ticket-Kategorie',  value: f(config.ticket_category_id),      inline: true },
      { name: 'Log-Channel',       value: f(config.ticket_log_channel_id),   inline: true },
      { name: 'Regelwerk-Channel', value: f(config.rules_channel_id),        inline: true },
      { name: 'Whitelist-Rolle',   value: r(config.whitelist_role_id),       inline: true },
      { name: 'Support-Rollen',    value: supportRoles.length > 0 ? supportRoles.map(id => `<@&${id}>`).join(' ') : '*keine*', inline: true },
      { name: 'Kategorien',        value: categories.length > 0 ? categories.map(c => `${c.emoji} ${c.label}`).join(', ') : '*keine*', inline: false },
      { name: 'Setup abgeschlossen', value: config.setup_completed ? '✅ Ja' : '⬜ Nein', inline: true },
    )
    .setTimestamp();
}

export function createDoctorEmbed(checks: DoctorCheck[]): EmbedBuilder {
  const emoji = { ok: '✅', warn: '⚠️', error: '❌' };
  const okCount = checks.filter(c => c.status === 'ok').length;
  const hasError = checks.some(c => c.status === 'error');
  const hasWarn = checks.some(c => c.status === 'warn');

  return new EmbedBuilder()
    .setColor(hasError ? COLORS.danger : hasWarn ? COLORS.warning : COLORS.success)
    .setTitle(`🩺 Diagnose — ${okCount}/${checks.length} Checks bestanden`)
    .setDescription(checks.map(c => `${emoji[c.status]} **${c.name}** — ${c.detail}`).join('\n'))
    .setTimestamp();
}

export function buildTicketPanelSelectMenu(categories: TicketCategoryConfig[]): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(IDS.TICKET_CATEGORY)
      .setPlaceholder('📂 Kategorie auswählen...')
      .addOptions(
        categories.map(cat =>
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.description)
            .setValue(cat.key)
            .setEmoji(cat.emoji)
        )
      )
  );
}

export function buildRulesAcceptButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.ACCEPT_RULES)
      .setLabel('Regeln akzeptieren')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );
}

export function buildAddCategoryModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('setup:cat:add')
    .setTitle('Kategorie hinzufügen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('key')
          .setLabel('Schlüssel (eindeutig, keine Leerzeichen)')
          .setPlaceholder('z.B. vip-support')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('label')
          .setLabel('Anzeigename')
          .setPlaceholder('z.B. VIP Support')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Beschreibung')
          .setPlaceholder('z.B. Für VIP-Spieler')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('emoji')
          .setLabel('Emoji')
          .setPlaceholder('z.B. ⭐')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(10)
          .setRequired(true)
      ),
    );
}
```

- [ ] **Step 3: Verify build**

```
npx tsc --noEmit
```

Expected: no errors in embedService.ts.

- [ ] **Step 4: Commit**

```
git add src/services/embedService.ts
git commit -m "feat: add setup wizard embed and component builder functions to embedService"
```

---

### Task 9: Create setup button dispatcher

**Files:**
- Create: `src/interactions/buttons/setup/setupDispatcher.ts`

- [ ] **Step 1: Create the file**

```typescript
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
  type ButtonInteraction,
} from 'discord.js';
import {
  getConfig, upsertConfig, getSupportRoles, getTicketCategories,
  getAllCategories, seedDefaultCategories, deleteCategory,
} from '../../../services/guildConfigService';
import {
  createSetupHomeEmbed, buildHomeComponents,
  createTicketSetupEmbed, buildTicketSetupComponents,
  createRulesSetupEmbed, buildRulesSetupComponents,
  createManageCategoriesEmbed, buildManageCategoriesComponents,
  createDoctorEmbed, buildAddCategoryModal,
  createTicketPanelEmbed, buildTicketPanelSelectMenu, buildRulesAcceptButton,
  createRulesEmbed,
} from '../../../services/embedService';
import { runDoctorChecks } from '../../../commands/doctor';
import { isAdmin } from '../../../services/permissionService';
import { replyError } from '../../../utils/errors';
import type { ButtonHandler } from '../../../types';

export const setupButtonDispatcher: ButtonHandler = {
  prefix: 's',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId = guild.id;

    if (payload === 'home') {
      const config = getConfig(guildId);
      return interaction.update({
        embeds: [createSetupHomeEmbed(config, guild)],
        components: buildHomeComponents(),
      });
    }

    if (payload === 'ticket') {
      const config = upsertConfig(guildId, {});
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createTicketSetupEmbed(config, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 'rules') {
      const config = upsertConfig(guildId, {});
      return interaction.update({
        embeds: [createRulesSetupEmbed(config, guild)],
        components: buildRulesSetupComponents(),
      });
    }

    if (payload === 'doctor') {
      await interaction.deferUpdate();
      const checks = await runDoctorChecks(guild);
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('s:home').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        embeds: [createDoctorEmbed(checks)],
        components: [backRow],
      });
    }

    if (payload === 'complete') {
      upsertConfig(guildId, { setup_completed: 1 });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createSetupHomeEmbed(config, guild)],
        components: buildHomeComponents(),
      });
    }

    if (payload === 't:pub') {
      await interaction.deferUpdate();
      const config = getConfig(guildId);
      if (!config?.ticket_panel_channel_id) {
        return interaction.editReply({ content: '❌ Bitte zuerst den Panel-Channel konfigurieren.' });
      }
      const channel = await guild.channels.fetch(config.ticket_panel_channel_id).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.editReply({ content: '❌ Panel-Channel nicht gefunden.' });
      }
      seedDefaultCategories(guildId);
      const categories = getTicketCategories(guildId);
      const embed = createTicketPanelEmbed();
      const selectRow = buildTicketPanelSelectMenu(categories);

      let messageId = config.ticket_panel_message_id ?? null;
      if (messageId) {
        try {
          const msg = await channel.messages.fetch(messageId);
          await msg.edit({ embeds: [embed], components: [selectRow] });
        } catch {
          messageId = null;
        }
      }
      if (!messageId) {
        const msg = await channel.send({ embeds: [embed], components: [selectRow] });
        messageId = msg.id;
      }

      upsertConfig(guildId, { ticket_panel_message_id: messageId });
      const updatedConfig = getConfig(guildId)!;
      const supportRoles = getSupportRoles(guildId);
      return interaction.editReply({
        embeds: [createTicketSetupEmbed(updatedConfig, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 't:cats') {
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createManageCategoriesEmbed(categories)],
        components: buildManageCategoriesComponents(categories),
      });
    }

    if (payload === 't:cat:add') {
      return interaction.showModal(buildAddCategoryModal());
    }

    if (payload.startsWith('t:cat:del:')) {
      const key = payload.slice('t:cat:del:'.length);
      deleteCategory(guildId, key);
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createManageCategoriesEmbed(categories)],
        components: buildManageCategoriesComponents(categories),
      });
    }

    if (payload === 'r:pub') {
      await interaction.deferUpdate();
      const config = getConfig(guildId);
      if (!config?.rules_channel_id) {
        return interaction.editReply({ content: '❌ Bitte zuerst den Regelwerk-Channel konfigurieren.' });
      }
      const channel = await guild.channels.fetch(config.rules_channel_id).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.editReply({ content: '❌ Regelwerk-Channel nicht gefunden.' });
      }

      const embed = createRulesEmbed();
      const buttonRow = buildRulesAcceptButton();

      let messageId = config.rules_message_id ?? null;
      if (messageId) {
        try {
          const msg = await channel.messages.fetch(messageId);
          await msg.edit({ embeds: [embed], components: [buttonRow] });
        } catch {
          messageId = null;
        }
      }
      if (!messageId) {
        const msg = await channel.send({ embeds: [embed], components: [buttonRow] });
        messageId = msg.id;
      }

      upsertConfig(guildId, { rules_message_id: messageId });
      const updatedConfig = getConfig(guildId)!;
      return interaction.editReply({
        embeds: [createRulesSetupEmbed(updatedConfig, guild)],
        components: buildRulesSetupComponents(),
      });
    }
  },
};
```

- [ ] **Step 2: Commit**

```
git add src/interactions/buttons/setup/setupDispatcher.ts
git commit -m "feat: add setup button dispatcher for all s:* button interactions"
```

---

### Task 10: Create channel select + role select dispatchers

**Files:**
- Create: `src/interactions/channelSelects/setupChannelSelectDispatcher.ts`
- Create: `src/interactions/roleSelects/setupRoleSelectDispatcher.ts`

- [ ] **Step 1: Create channelSelects/setupChannelSelectDispatcher.ts**

```typescript
import type { ChannelSelectMenuInteraction } from 'discord.js';
import {
  getConfig, upsertConfig, getSupportRoles,
} from '../../services/guildConfigService';
import {
  createTicketSetupEmbed, buildTicketSetupComponents,
  createRulesSetupEmbed, buildRulesSetupComponents,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ChannelSelectMenuHandler } from '../../types';

export const setupChannelSelectDispatcher: ChannelSelectMenuHandler = {
  prefix: 's',

  async execute(interaction: ChannelSelectMenuInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId = guild.id;
    const channelId = interaction.values[0];
    if (!channelId) return;

    if (payload === 't:panel') {
      upsertConfig(guildId, { ticket_panel_channel_id: channelId });
      const config = getConfig(guildId)!;
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createTicketSetupEmbed(config, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 't:cat') {
      upsertConfig(guildId, { ticket_category_id: channelId });
      const config = getConfig(guildId)!;
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createTicketSetupEmbed(config, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 't:log') {
      upsertConfig(guildId, { ticket_log_channel_id: channelId });
      const config = getConfig(guildId)!;
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createTicketSetupEmbed(config, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 'r:ch') {
      upsertConfig(guildId, { rules_channel_id: channelId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createRulesSetupEmbed(config, guild)],
        components: buildRulesSetupComponents(),
      });
    }
  },
};
```

- [ ] **Step 2: Create roleSelects/setupRoleSelectDispatcher.ts**

```typescript
import type { RoleSelectMenuInteraction } from 'discord.js';
import {
  getConfig, upsertConfig, getSupportRoles, setSupportRoles,
} from '../../services/guildConfigService';
import {
  createTicketSetupEmbed, buildTicketSetupComponents,
  createRulesSetupEmbed, buildRulesSetupComponents,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { RoleSelectMenuHandler } from '../../types';

export const setupRoleSelectDispatcher: RoleSelectMenuHandler = {
  prefix: 's',

  async execute(interaction: RoleSelectMenuInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId = guild.id;

    if (payload === 't:supp') {
      setSupportRoles(guildId, interaction.values);
      const config = getConfig(guildId) ?? upsertConfig(guildId, {});
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createTicketSetupEmbed(config, supportRoles, guild)],
        components: buildTicketSetupComponents(),
      });
    }

    if (payload === 'r:role') {
      const roleId = interaction.values[0];
      if (!roleId) return;
      upsertConfig(guildId, { whitelist_role_id: roleId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createRulesSetupEmbed(config, guild)],
        components: buildRulesSetupComponents(),
      });
    }
  },
};
```

- [ ] **Step 3: Commit**

```
git add src/interactions/channelSelects/setupChannelSelectDispatcher.ts src/interactions/roleSelects/setupRoleSelectDispatcher.ts
git commit -m "feat: add channel and role select dispatchers for setup wizard"
```

---

### Task 11: Create setup add-category modal handler

**Files:**
- Create: `src/interactions/modals/setupAddCategoryModal.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { ModalSubmitInteraction } from 'discord.js';
import { upsertCategory, getAllCategories } from '../../services/guildConfigService';
import {
  createManageCategoriesEmbed, buildManageCategoriesComponents,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ModalHandler } from '../../types';

export const setupAddCategoryModal: ModalHandler = {
  prefix: 'setup',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (payload !== 'cat:add') return;
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const guildId = interaction.guildId;
    const key = interaction.fields.getTextInputValue('key').toLowerCase().replace(/\s+/g, '-');
    const label = interaction.fields.getTextInputValue('label');
    const description = interaction.fields.getTextInputValue('description');
    const emoji = interaction.fields.getTextInputValue('emoji');

    const existing = getAllCategories(guildId);
    const sortOrder = existing.length;

    upsertCategory(guildId, {
      guild_id: guildId,
      key,
      label,
      description,
      emoji,
      sort_order: sortOrder,
      enabled: 1,
    });

    const categories = getAllCategories(guildId);
    await interaction.update({
      embeds: [createManageCategoriesEmbed(categories)],
      components: buildManageCategoriesComponents(categories),
    });
  },
};
```

- [ ] **Step 2: Commit**

```
git add src/interactions/modals/setupAddCategoryModal.ts
git commit -m "feat: add setup add-category modal handler"
```

---

### Task 12: Create /setup, /config, /doctor commands

**Files:**
- Create: `src/commands/setup.ts`
- Create: `src/commands/config.ts`
- Create: `src/commands/doctor.ts`

- [ ] **Step 1: Create setup.ts**

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getConfig } from '../services/guildConfigService';
import { createSetupHomeEmbed, buildHomeComponents } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Öffnet das Setup Center'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const config = getConfig(interaction.guildId);
    await interaction.reply({
      ephemeral: true,
      embeds: [createSetupHomeEmbed(config, interaction.guild)],
      components: buildHomeComponents(),
    });
  },
};
```

- [ ] **Step 2: Create config.ts**

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
  getConfig, getSupportRoles, getAllCategories,
} from '../services/guildConfigService';
import { createAdminPanelEmbed } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Zeigt die aktuelle Bot-Konfiguration'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const guildId = interaction.guildId;
    const config = getConfig(guildId);

    if (!config) {
      return replyError(interaction, 'Noch keine Konfiguration vorhanden. Führe `/setup` aus.');
    }

    const supportRoles = getSupportRoles(guildId);
    const categories = getAllCategories(guildId);

    await interaction.reply({
      ephemeral: true,
      embeds: [createAdminPanelEmbed(config, supportRoles, categories, interaction.guild)],
    });
  },
};
```

- [ ] **Step 3: Create doctor.ts — includes runDoctorChecks exported function**

```typescript
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import { getConfig, getSupportRoles } from '../services/guildConfigService';
import { createDoctorEmbed } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command, DoctorCheck } from '../types';

export async function runDoctorChecks(guild: Guild): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const config = getConfig(guild.id);
  const bot = guild.members.me;

  if (!config) {
    checks.push({ name: 'Konfiguration', status: 'error', detail: 'Noch kein /setup ausgeführt.' });
    return checks;
  }
  checks.push({ name: 'Konfiguration', status: 'ok', detail: 'guild_config vorhanden.' });

  const panelCh = config.ticket_panel_channel_id
    ? await guild.channels.fetch(config.ticket_panel_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Ticket-Panel-Channel',
    status: !config.ticket_panel_channel_id ? 'error' : panelCh ? 'ok' : 'error',
    detail: !config.ticket_panel_channel_id ? 'Nicht konfiguriert → Setup → Ticket-System.'
           : panelCh ? `<#${config.ticket_panel_channel_id}> gefunden.`
           : 'Channel nicht gefunden (gelöscht?). Setup neu konfigurieren.',
  });

  const ticketCat = config.ticket_category_id
    ? await guild.channels.fetch(config.ticket_category_id).catch(() => null)
    : null;
  checks.push({
    name: 'Ticket-Kategorie',
    status: !config.ticket_category_id ? 'error' : ticketCat ? 'ok' : 'error',
    detail: !config.ticket_category_id ? 'Nicht konfiguriert → Setup → Ticket-System.'
           : ticketCat ? `<#${config.ticket_category_id}> gefunden.`
           : 'Kategorie nicht gefunden (gelöscht?). Setup neu konfigurieren.',
  });

  const logCh = config.ticket_log_channel_id
    ? await guild.channels.fetch(config.ticket_log_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Log-Channel',
    status: !config.ticket_log_channel_id ? 'warn' : logCh ? 'ok' : 'error',
    detail: !config.ticket_log_channel_id ? 'Optional — nicht konfiguriert.'
           : logCh ? `<#${config.ticket_log_channel_id}> gefunden.`
           : 'Channel nicht gefunden. Setup neu konfigurieren.',
  });

  const rulesCh = config.rules_channel_id
    ? await guild.channels.fetch(config.rules_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Regelwerk-Channel',
    status: !config.rules_channel_id ? 'error' : rulesCh ? 'ok' : 'error',
    detail: !config.rules_channel_id ? 'Nicht konfiguriert → Setup → Regelwerk.'
           : rulesCh ? `<#${config.rules_channel_id}> gefunden.`
           : 'Channel nicht gefunden. Setup neu konfigurieren.',
  });

  const wlRole = config.whitelist_role_id
    ? await guild.roles.fetch(config.whitelist_role_id).catch(() => null)
    : null;
  checks.push({
    name: 'Whitelist-Rolle',
    status: !config.whitelist_role_id ? 'error' : wlRole ? 'ok' : 'error',
    detail: !config.whitelist_role_id ? 'Nicht konfiguriert → Setup → Regelwerk.'
           : wlRole ? `<@&${config.whitelist_role_id}> gefunden.`
           : 'Rolle nicht gefunden (gelöscht?). Setup neu konfigurieren.',
  });

  const supportRoles = getSupportRoles(guild.id);
  checks.push({
    name: 'Support-Rollen',
    status: supportRoles.length === 0 ? 'error' : 'ok',
    detail: supportRoles.length === 0
      ? 'Keine Support-Rollen konfiguriert → Setup → Ticket-System.'
      : `${supportRoles.length} Rolle(n) konfiguriert.`,
  });

  const hasMC = bot?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
  checks.push({
    name: 'Bot: ManageChannels',
    status: hasMC ? 'ok' : 'error',
    detail: hasMC ? 'Berechtigung vorhanden.' : 'Fehlend — Ticket-Erstellung schlägt fehl.',
  });

  const hasMR = bot?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
  checks.push({
    name: 'Bot: ManageRoles',
    status: hasMR ? 'ok' : 'error',
    detail: hasMR ? 'Berechtigung vorhanden.' : 'Fehlend — Rollenvergabe schlägt fehl.',
  });

  const hasSM = bot?.permissions.has(PermissionFlagsBits.SendMessages) ?? false;
  checks.push({
    name: 'Bot: SendMessages',
    status: hasSM ? 'ok' : 'error',
    detail: hasSM ? 'Berechtigung vorhanden.' : 'Fehlend — Bot kann keine Nachrichten senden.',
  });

  const hasEL = bot?.permissions.has(PermissionFlagsBits.EmbedLinks) ?? false;
  checks.push({
    name: 'Bot: EmbedLinks',
    status: hasEL ? 'ok' : 'error',
    detail: hasEL ? 'Berechtigung vorhanden.' : 'Fehlend — Embeds werden nicht angezeigt.',
  });

  if (wlRole && bot) {
    const above = bot.roles.highest.position > wlRole.position;
    checks.push({
      name: 'Bot-Rolle über Whitelist-Rolle',
      status: above ? 'ok' : 'error',
      detail: above ? 'Bot-Rolle steht korrekt über Whitelist-Rolle.'
             : 'Bot-Rolle ist unter Whitelist-Rolle → Rollenvergabe schlägt fehl. Server-Einstellungen → Rollen.',
    });
  } else {
    checks.push({
      name: 'Bot-Rolle über Whitelist-Rolle',
      status: 'warn',
      detail: 'Whitelist-Rolle nicht konfiguriert — Überprüfung übersprungen.',
    });
  }

  if (panelCh?.isTextBased() && bot) {
    const canWrite = panelCh.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages) ?? false;
    checks.push({
      name: 'Schreibzugriff Panel-Channel',
      status: canWrite ? 'ok' : 'error',
      detail: canWrite ? 'Bot kann schreiben.' : 'Kein Schreibzugriff — Channel-Berechtigungen prüfen.',
    });
  } else {
    checks.push({
      name: 'Schreibzugriff Panel-Channel',
      status: 'warn',
      detail: 'Panel-Channel nicht verfügbar — Überprüfung übersprungen.',
    });
  }

  if (rulesCh?.isTextBased() && bot) {
    const canWrite = rulesCh.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages) ?? false;
    checks.push({
      name: 'Schreibzugriff Regelwerk-Channel',
      status: canWrite ? 'ok' : 'error',
      detail: canWrite ? 'Bot kann schreiben.' : 'Kein Schreibzugriff — Channel-Berechtigungen prüfen.',
    });
  } else {
    checks.push({
      name: 'Schreibzugriff Regelwerk-Channel',
      status: 'warn',
      detail: 'Regelwerk-Channel nicht verfügbar — Überprüfung übersprungen.',
    });
  }

  if (config.ticket_panel_message_id && panelCh?.isTextBased()) {
    const msg = await panelCh.messages.fetch(config.ticket_panel_message_id).catch(() => null);
    checks.push({
      name: 'Panel-Nachricht',
      status: msg ? 'ok' : 'warn',
      detail: msg ? 'Panel-Nachricht existiert.' : 'Nicht mehr vorhanden — Panel neu veröffentlichen.',
    });
  } else {
    checks.push({
      name: 'Panel-Nachricht',
      status: 'warn',
      detail: !config.ticket_panel_message_id ? 'Panel noch nicht veröffentlicht.' : 'Panel-Channel nicht verfügbar.',
    });
  }

  return checks;
}

export const doctorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('doctor')
    .setDescription('Führt Diagnose-Checks durch'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    await interaction.deferReply({ ephemeral: true });

    const checks = await runDoctorChecks(interaction.guild);
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:home').setLabel('Setup öffnen').setEmoji('⚙️').setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [createDoctorEmbed(checks)],
      components: [backRow],
    });
  },
};
```

- [ ] **Step 4: Commit**

```
git add src/commands/setup.ts src/commands/config.ts src/commands/doctor.ts
git commit -m "feat: add /setup, /config, /doctor commands"
```

---

### Task 13: Wire up index.ts and deploy.ts; delete old commands

**Files:**
- Modify: `src/index.ts`
- Modify: `src/deploy.ts`
- Delete: `src/commands/setup-tickets.ts`
- Delete: `src/commands/setup-rules.ts`

- [ ] **Step 1: Rewrite index.ts**

```typescript
import { env } from './config/env';
import { initDb } from './db/index';
import { logger } from './utils/logger';
import {
  client, commands, buttonHandlers, selectMenuHandlers,
  channelSelectHandlers, roleSelectHandlers, modalHandlers,
} from './client';

// Commands
import { setupCommand } from './commands/setup';
import { configCommand } from './commands/config';
import { doctorCommand } from './commands/doctor';
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
import { setupButtonDispatcher } from './interactions/buttons/setup/setupDispatcher';

// Channel + Role Selects
import { setupChannelSelectDispatcher } from './interactions/channelSelects/setupChannelSelectDispatcher';
import { setupRoleSelectDispatcher } from './interactions/roleSelects/setupRoleSelectDispatcher';

// Modals
import { ticketAddModalHandler } from './interactions/modals/ticketAddModal';
import { ticketRemoveModalHandler } from './interactions/modals/ticketRemoveModal';
import { setupAddCategoryModal } from './interactions/modals/setupAddCategoryModal';

// Register commands
for (const cmd of [
  setupCommand, configCommand, doctorCommand,
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
  acceptRulesHandler, setupButtonDispatcher,
]) {
  buttonHandlers.set(handler.prefix, handler);
}

// Register channel + role selects
channelSelectHandlers.set(setupChannelSelectDispatcher.prefix, setupChannelSelectDispatcher);
roleSelectHandlers.set(setupRoleSelectDispatcher.prefix, setupRoleSelectDispatcher);

// Register modals
modalHandlers.set(ticketAddModalHandler.prefix, ticketAddModalHandler);
modalHandlers.set(ticketRemoveModalHandler.prefix, ticketRemoveModalHandler);
modalHandlers.set(setupAddCategoryModal.prefix, setupAddCategoryModal);

client.once('ready', (c) => {
  logger.info(`Bot online: ${c.user.tag} (${c.user.id})`);
  logger.info(`Commands: ${commands.size} | Buttons: ${buttonHandlers.size}`);
});

initDb(env.DATABASE_PATH);
client.login(env.DISCORD_TOKEN);
```

- [ ] **Step 2: Rewrite deploy.ts (global commands, no GUILD_ID)**

```typescript
import { REST, Routes } from 'discord.js';
import { env } from './config/env';
import { setupCommand } from './commands/setup';
import { configCommand } from './commands/config';
import { doctorCommand } from './commands/doctor';
import { ticketCloseCommand } from './commands/ticket-close';
import { ticketAddCommand } from './commands/ticket-add';
import { ticketRemoveCommand } from './commands/ticket-remove';
import { ticketRenameCommand } from './commands/ticket-rename';
import { ticketClaimCommand } from './commands/ticket-claim';
import { logger } from './utils/logger';

const commandList = [
  setupCommand, configCommand, doctorCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand,
];

const rest = new REST().setToken(env.DISCORD_TOKEN);

(async () => {
  logger.info(`Registriere ${commandList.length} Slash Commands (global)...`);
  const data = await rest.put(
    Routes.applicationCommands(env.CLIENT_ID),
    { body: commandList.map(c => c.data.toJSON()) },
  ) as unknown[];
  logger.info(`${data.length} Commands erfolgreich registriert.`);
})().catch(err => {
  logger.error('Command-Deployment fehlgeschlagen', err);
  process.exit(1);
});
```

- [ ] **Step 3: Delete old command files**

```
del "src\commands\setup-tickets.ts"
del "src\commands\setup-rules.ts"
```

- [ ] **Step 4: Verify full build**

```
npx tsc --noEmit
```

Expected: zero TypeScript errors.

- [ ] **Step 5: Commit**

```
git add src/index.ts src/deploy.ts
git rm src/commands/setup-tickets.ts src/commands/setup-rules.ts
git commit -m "feat: wire up new commands/handlers; remove setup-tickets and setup-rules"
```

---

### Task 14: Write tests

**Files:**
- Create: `src/services/guildConfigService.test.ts`
- Modify: `src/services/permissionService.test.ts`

- [ ] **Step 1: Write guildConfigService.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '../db/index';
import {
  getConfig, upsertConfig,
  getSupportRoles, setSupportRoles,
  getTicketCategories, getAllCategories,
  upsertCategory, deleteCategory,
  seedDefaultCategories,
} from './guildConfigService';

beforeEach(() => {
  initDb(':memory:');
});

describe('getConfig / upsertConfig', () => {
  it('returns undefined when no config exists', () => {
    expect(getConfig('g1')).toBeUndefined();
  });

  it('creates a config record', () => {
    const config = upsertConfig('g1', {});
    expect(config.guild_id).toBe('g1');
    expect(config.setup_completed).toBe(0);
    expect(config.ticket_panel_channel_id).toBeNull();
  });

  it('updates specific fields without clearing others', () => {
    upsertConfig('g1', { ticket_panel_channel_id: 'ch1' });
    upsertConfig('g1', { ticket_category_id: 'cat1' });
    const config = getConfig('g1')!;
    expect(config.ticket_panel_channel_id).toBe('ch1');
    expect(config.ticket_category_id).toBe('cat1');
  });

  it('sets setup_completed to 1', () => {
    upsertConfig('g1', {});
    upsertConfig('g1', { setup_completed: 1 });
    expect(getConfig('g1')!.setup_completed).toBe(1);
  });
});

describe('getSupportRoles / setSupportRoles', () => {
  it('returns empty array when none set', () => {
    expect(getSupportRoles('g1')).toEqual([]);
  });

  it('sets and retrieves support roles', () => {
    setSupportRoles('g1', ['r1', 'r2']);
    expect(getSupportRoles('g1')).toEqual(expect.arrayContaining(['r1', 'r2']));
  });

  it('replaces roles on second call', () => {
    setSupportRoles('g1', ['r1', 'r2']);
    setSupportRoles('g1', ['r3']);
    const roles = getSupportRoles('g1');
    expect(roles).toEqual(['r3']);
  });
});

describe('getTicketCategories / upsertCategory / deleteCategory', () => {
  it('returns empty array when none exist', () => {
    expect(getTicketCategories('g1')).toEqual([]);
  });

  it('creates a category', () => {
    upsertCategory('g1', {
      guild_id: 'g1', key: 'test', label: 'Test', description: 'Desc',
      emoji: '🔧', sort_order: 0, enabled: 1,
    });
    const cats = getTicketCategories('g1');
    expect(cats).toHaveLength(1);
    expect(cats[0].key).toBe('test');
  });

  it('updates existing category on upsert', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Old', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'New', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    const cats = getTicketCategories('g1');
    expect(cats[0].label).toBe('New');
  });

  it('deletes a category', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Test', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    deleteCategory('g1', 'test');
    expect(getTicketCategories('g1')).toHaveLength(0);
  });

  it('does not return disabled categories', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Test', description: 'D', emoji: '🔧', sort_order: 0, enabled: 0 });
    expect(getTicketCategories('g1')).toHaveLength(0);
    expect(getAllCategories('g1')).toHaveLength(1);
  });
});

describe('seedDefaultCategories', () => {
  it('creates 6 default categories', () => {
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(6);
  });

  it('is idempotent — second call does not add duplicates', () => {
    seedDefaultCategories('g1');
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(6);
  });

  it('does not seed if categories already exist', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'custom', label: 'Custom', description: 'D', emoji: '❓', sort_order: 0, enabled: 1 });
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rewrite permissionService.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { isAdmin, isSupport, isTicketOwner, canModerateTicket } from './permissionService';
import type { GuildMember } from 'discord.js';
import type { Ticket } from '../types';

vi.mock('./guildConfigService', () => ({
  getSupportRoles: (guildId: string) => guildId === 'g1' ? ['support-role'] : [],
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
  id: 1, guild_id: 'g1', channel_id: 'c', opener_user_id: 'owner1',
  category: 'allgemein', status: 'open', claimed_by: null,
  created_at: 1, closed_at: null,
};

describe('isAdmin', () => {
  it('true for Administrator permission', () =>
    expect(isAdmin(makeMember({ permissions: PermissionFlagsBits.Administrator }))).toBe(true));
  it('true for ManageGuild permission', () =>
    expect(isAdmin(makeMember({ permissions: PermissionFlagsBits.ManageGuild }))).toBe(true));
  it('false for no permissions', () =>
    expect(isAdmin(makeMember({}))).toBe(false));
  it('false for unrelated role (no longer checks role IDs)', () =>
    expect(isAdmin(makeMember({ roles: ['some-role'] }))).toBe(false));
});

describe('isSupport', () => {
  it('true when guild has the role and member has it', () =>
    expect(isSupport(makeMember({ roles: ['support-role'] }), 'g1')).toBe(true));
  it('false when member lacks the role', () =>
    expect(isSupport(makeMember({ roles: [] }), 'g1')).toBe(false));
  it('false when guild has no support roles configured', () =>
    expect(isSupport(makeMember({ roles: ['support-role'] }), 'other-guild')).toBe(false));
});

describe('isTicketOwner', () => {
  it('true when member is opener', () =>
    expect(isTicketOwner(makeMember({ id: 'owner1' }), ticket)).toBe(true));
  it('false for other users', () =>
    expect(isTicketOwner(makeMember({ id: 'other' }), ticket)).toBe(false));
});

describe('canModerateTicket', () => {
  it('allows admin (Administrator perm)', () =>
    expect(canModerateTicket(makeMember({ permissions: PermissionFlagsBits.Administrator }), ticket, 'g1')).toBe(true));
  it('allows admin (ManageGuild perm)', () =>
    expect(canModerateTicket(makeMember({ permissions: PermissionFlagsBits.ManageGuild }), ticket, 'g1')).toBe(true));
  it('allows support role from DB', () =>
    expect(canModerateTicket(makeMember({ roles: ['support-role'] }), ticket, 'g1')).toBe(true));
  it('allows ticket owner', () =>
    expect(canModerateTicket(makeMember({ id: 'owner1' }), ticket, 'g1')).toBe(true));
  it('denies others', () =>
    expect(canModerateTicket(makeMember({ id: 'stranger' }), ticket, 'g1')).toBe(false));
});
```

- [ ] **Step 3: Run tests**

```
npm test
```

Expected: all tests pass including new guildConfigService and updated permissionService tests.

- [ ] **Step 4: Commit**

```
git add src/services/guildConfigService.test.ts src/services/permissionService.test.ts
git commit -m "test: add guildConfigService tests; update permissionService tests for new API"
```

---

### Task 15: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with updated version**

```markdown
# SCUM Discord Bot

Professioneller Discord-Bot für SCUM-Gaming-Server mit Ticket-System und Whitelist-Rollenvergabe über Regelakzeptanz. Multi-Guild-fähig — alle Einstellungen werden über Discord-native Befehle konfiguriert.

---

## Voraussetzungen

- Node.js 20+ (LTS) — [nodejs.org](https://nodejs.org)
- npm 9+
- Ein Discord-Server mit Administrator-Rechten

---

## 1. Bot im Discord Developer Portal erstellen

1. Gehe zu [discord.com/developers/applications](https://discord.com/developers/applications)
2. Klicke **New Application** → gib einen Namen ein
3. Wechsle zu **Bot** → klicke **Add Bot**
4. Kopiere den **Token** → für `DISCORD_TOKEN`
5. Kopiere die **Application ID** → für `CLIENT_ID`
6. Aktiviere unter **Privileged Gateway Intents**:
   - `SERVER MEMBERS INTENT` ✅
   - `MESSAGE CONTENT INTENT` ✅

---

## 2. Bot einladen

Ersetze `CLIENT_ID` in der URL und öffne sie im Browser:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Permission `8` = Administrator (empfohlen für vollständigen Betrieb).

---

## 3. Installation

```bash
git clone <repo-url>
cd scum-discord-bot
npm install
cp .env.example .env
```

---

## 4. `.env` ausfüllen

Öffne `.env` und trage die drei Werte ein:

| Variable | Beschreibung | Wo finden |
|---|---|---|
| `DISCORD_TOKEN` | Bot-Token | Developer Portal → Bot |
| `CLIENT_ID` | Application ID | Developer Portal → General Information |
| `DATABASE_PATH` | Pfad zur SQLite-Datei (optional) | Standard: `./data/bot.db` |

Alle weiteren Einstellungen (Channels, Rollen, Kategorien) werden direkt über Discord konfiguriert.

---

## 5. Commands deployen

```bash
npm run deploy:commands
```

> **Hinweis:** Globale Commands können bis zu 1 Stunde brauchen, um auf allen Servern zu erscheinen.

---

## 6. Bot starten

**Entwicklung (mit Auto-Reload):**
```bash
npm run dev
```

**Produktion:**
```bash
npm run build
npm start
```

---

## 7. Server einrichten mit `/setup`

Nach dem Start führe in einem Admin-Channel aus:

```
/setup
```

Der Bot öffnet ein interaktives **Setup Center** als ephemeral Message (nur du siehst sie).

### Setup-Schritte:

**🎫 Ticket-System:**
1. Panel-Channel auswählen (wo das Ticket-Panel erscheint)
2. Ticket-Kategorie auswählen (Discord-Kategorie für neue Ticket-Channels)
3. Log-Channel auswählen (optional — für Ereignis-Logs)
4. Support-Rollen auswählen (haben Zugriff auf alle Tickets)
5. **Panel veröffentlichen** → postet das Panel im gewählten Channel

**📜 Regelwerk:**
1. Regelwerk-Channel auswählen
2. Whitelist-Rolle auswählen (wird bei Regelakzeptanz vergeben)
3. **Regelwerk veröffentlichen** → postet das Regelwerk mit Akzeptier-Button

**📦 Kategorien verwalten:**
- Standard-Kategorien werden automatisch erstellt (6 Stück)
- Eigene Kategorien können über den **Kategorien**-Button hinzugefügt/gelöscht werden

**✅ Abschließen:**
- Markiert das Setup als abgeschlossen

---

## Commands-Übersicht

| Command | Berechtigung | Funktion |
|---|---|---|
| `/setup` | Administrator / Server verwalten | Setup Center öffnen |
| `/config` | Administrator / Server verwalten | Aktuelle Konfiguration anzeigen |
| `/doctor` | Administrator / Server verwalten | 15 Diagnose-Checks durchführen |
| `/ticket-close` | Ersteller / Support / Admin | Ticket schließen (mit Bestätigung) |
| `/ticket-add @user` | Support / Admin | User Zugriff auf Ticket geben |
| `/ticket-remove @user` | Support / Admin | User aus Ticket entfernen |
| `/ticket-rename <name>` | Support / Admin | Channel umbenennen |
| `/ticket-claim` | Support / Admin | Ticket übernehmen |

---

## Troubleshooting

### „Das Ticket-System ist nicht konfiguriert"
→ Führe `/setup` aus und konfiguriere Ticket-System + Panel.

### „Missing Access" beim Ticket-erstellen
Der Bot hat keine Berechtigung in der Ticket-Kategorie.  
→ Prüfe die Berechtigungen der Ticket-Kategorie (ManageChannels für den Bot).

### „Missing Permissions" beim Rollenvergeben
Die Bot-Rolle muss **über** der Whitelist-Rolle stehen.  
→ Server-Einstellungen → Rollen → Bot-Rolle nach oben ziehen.  
→ `/doctor` zeigt diesen Check an.

### Buttons / Select Menus reagieren nicht nach Neustart
Der Bot ist offline.  
→ `npm run dev` oder `npm start` ausführen.

### Commands erscheinen nicht in Discord
Globale Commands können bis zu 1 Stunde dauern.  
→ `npm run deploy:commands` erneut ausführen.

---

## Projektstruktur

```
src/
├── index.ts              # Einstiegspunkt
├── client.ts             # Discord Client + Interaction-Dispatcher
├── deploy.ts             # Command-Registrierung (global)
├── config/
│   ├── env.ts            # .env-Loader (nur TOKEN + CLIENT_ID + DB_PATH)
│   └── constants.ts      # Farben
├── commands/             # Slash Commands
├── interactions/
│   ├── buttons/          # Button-Handler (inkl. setup/)
│   ├── channelSelects/   # ChannelSelectMenu-Handler
│   ├── roleSelects/      # RoleSelectMenu-Handler
│   ├── selectMenus/      # StringSelectMenu-Handler
│   └── modals/           # Modal-Handler
├── services/             # Business Logic
├── db/                   # SQLite-Datenbankschicht
├── utils/                # Logger, Fehler, IDs
└── types/                # TypeScript-Interfaces
```

---

## Tests

```bash
npm test
```

Tests decken ab: DB-Queries (tickets, guild_config, support_roles, categories), Permission-Checks, ID-Utilities.
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: update README for setup wizard and simplified env config"
```

---

## Self-Review

**Spec coverage check:**
- ✅ DB schema: 3 new tables with all required columns
- ✅ guildConfigService: all 8 methods from spec
- ✅ permissionService: isAdmin (perms only), isSupport (guildId), canModerateTicket (guildId), canSetup removed
- ✅ ticketService: reads from DB instead of env
- ✅ logService: silent return when not configured
- ✅ roleService: throws BotError when not configured
- ✅ client.ts: channelSelectHandlers + roleSelectHandlers + 2 new branches
- ✅ /setup opens Setup Center as ephemeral
- ✅ /config shows current config with mentions
- ✅ /doctor runs 15 checks
- ✅ customId scheme: all s:* IDs under 100 chars
- ✅ setup-tickets.ts and setup-rules.ts deleted
- ✅ panels table kept (used by existing upsertPanel/getPanel functions which can stay)
- ✅ Bot starts with only DISCORD_TOKEN + CLIENT_ID + DATABASE_PATH
- ✅ Tests: guildConfigService (12 cases) + permissionService (9 cases)
- ✅ README updated

**Type consistency:**
- `upsertConfig` in Task 3 and calls in Tasks 9/10/11 all use same signature
- `runDoctorChecks` exported from `doctor.ts` and imported in `setupDispatcher.ts`
- `buildHomeComponents()` returns `ActionRowBuilder<ButtonBuilder>[]` — used in setup.ts and setupDispatcher.ts ✅
- `buildTicketSetupComponents()` returns `ActionRowBuilder<MessageActionRowComponentBuilder>[]` — used in channel/role select dispatchers ✅
