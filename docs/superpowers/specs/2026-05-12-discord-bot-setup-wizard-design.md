# Discord Bot — Setup Wizard & DB-basierte Konfiguration

**Datum:** 2026-05-12  
**Status:** Genehmigt  
**Ansatz:** Big Bang — vollständige Migration, kein env-Fallback

---

## Überblick

Ersetzt alle guild-spezifischen `.env`-Felder durch eine SQLite-Datenbank. Admins konfigurieren den Bot vollständig über Discord-native Slash Commands, Embeds, Buttons und Select Menus. Der Bot unterstützt mehrere Server (Multi-Guild).

---

## .env nach dem Umbau

```
DISCORD_TOKEN=
CLIENT_ID=
DATABASE_PATH=./data/bot.db
NODE_ENV=development
```

Alle guild-spezifischen Felder (TICKET_PANEL_CHANNEL_ID, TICKET_CATEGORY_ID, etc.) werden aus `.env` entfernt.

---

## Datenbankschema

### Neue Tabellen

**`guild_config`** (eine Zeile pro Server)
```sql
CREATE TABLE guild_config (
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
);
```

**`guild_support_roles`** (viele pro Server)
```sql
CREATE TABLE guild_support_roles (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  role_id  TEXT NOT NULL,
  UNIQUE(guild_id, role_id)
);
```

**`ticket_category_config`** (Ticket-Kategorien pro Server, konfigurierbar)
```sql
CREATE TABLE ticket_category_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(guild_id, key)
);
```

### Bestehende Tabellen
- `tickets` — unverändert
- `panels` — wird nicht mehr genutzt; bleibt in DB, wird aber ignoriert

---

## Neue TypeScript-Typen

```typescript
interface GuildConfig {
  guild_id: string;
  ticket_panel_channel_id: string | null;
  ticket_category_id: string | null;
  ticket_log_channel_id: string | null;
  rules_channel_id: string | null;
  whitelist_role_id: string | null;
  ticket_panel_message_id: string | null;
  rules_message_id: string | null;
  setup_completed: number; // 0 | 1
  created_at: number;
  updated_at: number;
}

interface GuildSupportRole {
  id: number;
  guild_id: string;
  role_id: string;
}

interface TicketCategoryConfig {
  id: number;
  guild_id: string;
  key: string;
  label: string;
  description: string;
  emoji: string;
  sort_order: number;
  enabled: number; // 0 | 1
}
```

---

## Neuer `guildConfigService.ts`

Zentraler Zugriffspunkt für guild-spezifische Einstellungen.

```typescript
getConfig(guildId: string): GuildConfig | undefined
upsertConfig(guildId: string, data: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>): GuildConfig
getSupportRoles(guildId: string): string[]
setSupportRoles(guildId: string, roleIds: string[]): void
getTicketCategories(guildId: string): TicketCategoryConfig[]
upsertCategory(guildId: string, data: Omit<TicketCategoryConfig, 'id'>): void
deleteCategory(guildId: string, key: string): void
seedDefaultCategories(guildId: string): void  // Setzt Default-Kategorien beim ersten Setup
```

---

## Permission Refactoring

### `permissionService.ts`

`isAdmin` nutzt nur noch Discord-native Permissions (kein ADMIN_ROLE_IDS mehr):
```typescript
isAdmin(member: GuildMember): boolean
// → member.permissions.has(Administrator) OR member.permissions.has(ManageGuild)
```

`isSupport` liest Support-Rollen aus DB (synchron via SQLite):
```typescript
isSupport(member: GuildMember, guildId: string): boolean
// → getSupportRoles(guildId).some(id => member.roles.cache.has(id))
```

`canModerateTicket` bekommt guildId:
```typescript
canModerateTicket(member: GuildMember, ticket: Ticket, guildId: string): boolean
```

`canSetup` vereinfacht: Da `isAdmin` jetzt `Administrator OR ManageGuild` prüft, ist `canSetup = isAdmin`. Separate Funktion kann entfernt werden.

### Betroffene Aufrufer

Alle Commands und Interaction-Handler, die `isSupport` oder `canModerateTicket` aufrufen, erhalten den `guildId`-Parameter via `interaction.guildId`.

---

## Service-Refactoring

### `ticketService.ts`

`openTicket(guild, member, categoryId)` liest statt `env.X`:
- `getConfig(guild.id)?.ticket_category_id` → parent der neuen Channels
- `getSupportRoles(guild.id)` → Permission Overwrites
- `getTicketCategories(guild.id)` → Kategorie-Label für Channel-Name und Embed
- Wenn `ticket_category_id` nicht gesetzt: wirft `BotError` mit Hinweis auf `/setup`

### `logService.ts`

`logEvent(guild, event, fields)` liest `getConfig(guild.id)?.ticket_log_channel_id`.  
Wenn nicht gesetzt: silent return (kein Fehler — Log ist optional).

### `roleService.ts`

`assignWhitelistRole(member)` liest `getConfig(member.guild.id)?.whitelist_role_id`.  
Wenn nicht gesetzt: wirft `BotError` mit Hinweis auf `/setup`.

---

## Neue Commands

### `/setup`
Öffnet das Setup Center als ephemeral Message. Nur für Admins/ManageGuild.

### `/config`
Öffnet das Admin Control Panel. Zeigt aktuelle Konfiguration mit Mentions.

### `/doctor`
Führt ~15 Diagnose-Checks durch und gibt Embed mit ✅/⚠️/❌ zurück.

---

## customId-Schema (alle < 100 Zeichen)

```
s:home              Setup Home
s:ticket            Ticket-Setup-Seite
s:rules             Regelwerk-Setup-Seite
s:doctor            Diagnose ausführen
s:admin             Admin Panel öffnen
s:complete          Setup abschließen (setup_completed = 1)

s:t:panel           ChannelSelect: Ticket-Panel-Channel
s:t:cat             ChannelSelect: Ticket-Kategorie (Discord-Kategorie)
s:t:log             ChannelSelect: Log-Channel
s:t:supp            RoleSelect: Support-Rollen (multi)
s:t:pub             Ticket-Panel veröffentlichen
s:t:cats            Ticket-Kategorien verwalten
s:t:cat:add         Kategorie hinzufügen (Modal)
s:t:cat:del:{key}   Kategorie löschen (max key-länge beachten)

s:r:ch              ChannelSelect: Regelwerk-Channel
s:r:role            RoleSelect: Whitelist-Rolle (single)
s:r:pub             Regelwerk veröffentlichen
```

---

## Dispatcher-Erweiterung (`client.ts`)

Zwei neue Handler-Maps:
```typescript
channelSelectHandlers = new Map<string, ChannelSelectMenuHandler>()
roleSelectHandlers    = new Map<string, RoleSelectMenuHandler>()
```

Neue Interfaces:
```typescript
interface ChannelSelectMenuHandler {
  prefix: string;
  execute(interaction: ChannelSelectMenuInteraction, payload: string): Promise<unknown>;
}
interface RoleSelectMenuHandler {
  prefix: string;
  execute(interaction: RoleSelectMenuInteraction, payload: string): Promise<unknown>;
}
```

Der `interactionCreate`-Handler bekommt zwei neue Branches:
```typescript
if (interaction.isChannelSelectMenu()) { ... }
if (interaction.isRoleSelectMenu()) { ... }
```

**Setup-Routing-Prinzip:**
`parseId` splittet auf dem ersten `:`. Alle Setup-Interactions haben prefix=`s`, payload=`t:panel`, `r:ch`, `home`, etc. Es wird **ein zentraler Setup-Handler pro Interaction-Typ** registriert, der intern via payload routet:
```typescript
buttonHandlers.set('s', setupButtonDispatcher)
channelSelectHandlers.set('s', setupChannelSelectDispatcher)
roleSelectHandlers.set('s', setupRoleSelectDispatcher)
```
Jeder Dispatcher ist eine einzelne Datei mit einem `switch`/`if`-Block über den payload.

---

## Neue Ordnerstruktur

```
src/
  commands/
    setup.ts                    (neu)
    config.ts                   (neu)
    doctor.ts                   (neu)
    setup-tickets.ts            (entfernt — Funktion wandert in Setup Wizard)
    setup-rules.ts              (entfernt — Funktion wandert in Setup Wizard)
  interactions/
    buttons/
      setup/
        setupHome.ts            (s:home)
        setupTicket.ts          (s:ticket)
        setupRules.ts           (s:rules)
        setupDoctor.ts          (s:doctor)
        setupAdmin.ts           (s:admin)
        setupComplete.ts        (s:complete)
        setupPublishPanel.ts    (s:t:pub)
        setupPublishRules.ts    (s:r:pub)
        setupManageCategories.ts (s:t:cats)
        setupAddCategory.ts     (s:t:cat:add — öffnet Modal)
        setupDeleteCategory.ts  (s:t:cat:del)
    channelSelects/             (neu)
        setupPanelChannel.ts    (s:t:panel)
        setupTicketCategory.ts  (s:t:cat)
        setupLogChannel.ts      (s:t:log)
        setupRulesChannel.ts    (s:r:ch)
    roleSelects/                (neu)
        setupSupportRoles.ts    (s:t:supp)
        setupWhitelistRole.ts   (s:r:role)
    modals/
        setupAddCategoryModal.ts (neu)
  services/
    guildConfigService.ts       (neu)
    ticketService.ts            (refactored)
    logService.ts               (refactored)
    roleService.ts              (refactored)
    permissionService.ts        (refactored)
    embedService.ts             (erweitert um Setup-Embeds)
```

---

## Setup Wizard Flow

```
/setup
  └─ SetupHomeEmbed
       Status: X/4 Schritte ✅
       [🎫 Ticket-System] [📜 Regelwerk] [🧪 Diagnose] [✅ Abschließen]

  Ticket-System:
       ChannelSelect: Panel-Channel    → speichert, aktualisiert Embed
       ChannelSelect: Ticket-Kategorie → speichert
       ChannelSelect: Log-Channel      → speichert
       RoleSelect: Support-Rollen      → speichert (multi)
       [📤 Panel veröffentlichen]      → postet Panel, speichert messageId
       [← Zurück]                      → SetupHomeEmbed

  Regelwerk:
       ChannelSelect: Regelwerk-Channel  → speichert
       RoleSelect: Whitelist-Rolle       → speichert (single)
       [📤 Regelwerk veröffentlichen]    → postet Regelwerk
       [← Zurück]                        → SetupHomeEmbed
```

---

## Embed-Funktionen (neu in `embedService.ts`)

```typescript
createSetupHomeEmbed(config: GuildConfig | undefined, guild: Guild): EmbedBuilder
createTicketSetupEmbed(config: GuildConfig, supportRoles: string[], guild: Guild): EmbedBuilder
createRulesSetupEmbed(config: GuildConfig, guild: Guild): EmbedBuilder
createAdminPanelEmbed(config: GuildConfig, supportRoles: string[], categories: TicketCategoryConfig[], guild: Guild): EmbedBuilder
createDoctorEmbed(checks: DoctorCheck[]): EmbedBuilder
createConfigSavedEmbed(field: string, value: string): EmbedBuilder
```

---

## Doctor-Checks

15 Checks, jeder mit Status `ok | warn | error` und Handlungsempfehlung:

1. Guild Config vorhanden
2. Ticket-Panel-Channel existiert
3. Ticket-Kategorie existiert
4. Log-Channel existiert
5. Regelwerk-Channel existiert
6. Whitelist-Rolle existiert
7. Support-Rollen konfiguriert (min. 1)
8. Bot hat ManageChannels
9. Bot hat ManageRoles
10. Bot hat SendMessages
11. Bot hat EmbedLinks
12. Bot-Rolle über Whitelist-Rolle
13. Bot kann in Panel-Channel schreiben
14. Bot kann in Regelwerk-Channel schreiben
15. Panel-Nachricht existiert noch (optional)

---

## Backward Compatibility

- `setup-tickets.ts` und `setup-rules.ts` werden entfernt
- Bestehende Tickets in der DB sind weiterhin gültig (tickets-Tabelle unverändert)
- `panels`-Tabelle bleibt in DB, wird aber ignoriert
- Bot startet ohne guild-spezifische `.env`-Felder

---

## Akzeptanzkriterien

- Bot startet mit nur DISCORD_TOKEN + CLIENT_ID + DATABASE_PATH in .env
- `/setup` öffnet Setup Center
- Alle Wizard-Schritte speichern korrekt in DB
- Panel und Regelwerk werden per Button veröffentlicht
- Ticket-Erstellung liest Konfiguration aus DB
- Whitelist-Rollenvergabe liest aus DB
- Log-Events werden an konfigurierten Channel gesendet
- `/config` zeigt aktuelle Konfiguration mit Mentions
- `/doctor` zeigt alle 15 Checks mit Empfehlungen
- Buttons/Selects nach Bot-Neustart persistent
- TypeScript Build ohne Fehler
- README erklärt neuen Setup-Prozess
