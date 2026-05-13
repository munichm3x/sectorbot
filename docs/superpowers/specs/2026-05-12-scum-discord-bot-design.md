# SCUM Discord Bot — Design Spec

**Datum:** 2026-05-12  
**Status:** Genehmigt  

---

## Überblick

Professioneller Discord-Bot für einen SCUM-Gaming-Server. Implementiert ein Ticket-System und eine Whitelist-Rollenvergabe via Regelakzeptanz. Alle Nutzer-facing Texte auf Deutsch. Gebaut mit TypeScript, discord.js v14, better-sqlite3.

---

## Architektur

**Ansatz:** Command/Interaction-Registry mit zentralem Dispatcher.

Commands und Interaction-Handler werden beim Start dynamisch geladen und in Registries eingetragen. Ein zentraler Dispatcher in `client.ts` routet alle Interactions über die `customId` (Format: `prefix:payload`). Services sind von Commands/Interactions entkoppelt.

### Ordnerstruktur

```
src/
├── index.ts
├── client.ts
├── deploy.ts
├── config/
│   ├── env.ts
│   └── constants.ts
├── commands/
│   ├── setup-tickets.ts
│   ├── setup-rules.ts
│   ├── ticket-close.ts
│   ├── ticket-add.ts
│   ├── ticket-remove.ts
│   ├── ticket-rename.ts
│   └── ticket-claim.ts
├── interactions/
│   ├── buttons/
│   │   ├── createTicket.ts
│   │   ├── closeTicket.ts
│   │   ├── confirmClose.ts
│   │   ├── cancelClose.ts
│   │   ├── claimTicket.ts
│   │   ├── addUserPrompt.ts
│   │   ├── removeUserPrompt.ts
│   │   └── acceptRules.ts
│   └── selectMenus/
│       └── ticketCategory.ts
├── services/
│   ├── ticketService.ts
│   ├── roleService.ts
│   ├── embedService.ts
│   ├── permissionService.ts
│   └── logService.ts
├── db/
│   ├── index.ts
│   └── schema.ts
├── utils/
│   ├── logger.ts
│   ├── errors.ts
│   └── ids.ts
└── types/
    └── index.ts
```

### Startup-Flow

`index.ts` → `env.ts` (Validierung, bricht bei fehlenden Vars ab) → DB initialisieren (`CREATE TABLE IF NOT EXISTS`) → Commands/Interactions in Registries laden → Discord Client starten → `ready`-Event loggt Verbindung.

### customId-Routing

Format: `prefix:payload` — z.B. `ticket_category:allgemein`, `ticket_close:channelId`.  
Dispatcher in `client.ts` splittet per `:`, sucht Handler in Registry. Funktioniert nach jedem Neustart ohne Collectors.

---

## Datenmodell (SQLite, better-sqlite3)

### Tabelle `tickets`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `guild_id` | TEXT NOT NULL | |
| `channel_id` | TEXT UNIQUE NOT NULL | |
| `opener_user_id` | TEXT NOT NULL | |
| `category` | TEXT NOT NULL | |
| `status` | TEXT NOT NULL | `open` \| `closed` |
| `claimed_by` | TEXT NULL | |
| `created_at` | INTEGER NOT NULL | Unix-Timestamp |
| `closed_at` | INTEGER NULL | |

### Tabelle `panels`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `guild_id` | TEXT NOT NULL | |
| `type` | TEXT NOT NULL | `tickets` \| `rules` |
| `channel_id` | TEXT NOT NULL | |
| `message_id` | TEXT NOT NULL | |

Keine Migrations-Runner. Tabellen werden per `CREATE TABLE IF NOT EXISTS` beim Start erstellt.

---

## Commands & Interactions

### Slash Commands (Guild-scoped)

| Command | Berechtigung | Funktion |
|---|---|---|
| `/setup-tickets` | ManageGuild / Admin | Ticket-Panel erstellen/aktualisieren |
| `/setup-rules` | ManageGuild / Admin | Regelwerk erstellen/aktualisieren |
| `/ticket-close` | Ersteller / Support / Admin | Schließ-Bestätigung starten |
| `/ticket-add [user]` | Support / Admin | User Zugriff geben |
| `/ticket-remove [user]` | Support / Admin | User Zugriff entziehen |
| `/ticket-rename [name]` | Support / Admin | Channel umbenennen |
| `/ticket-claim` | Support / Admin | Ticket übernehmen |

### Ticket erstellen — Flow

```
Select Menu (Kategorie wählen)
  → ticketCategory-Handler
    → Doppel-Ticket-Check (DB)
    → Falls offen: ephemeral Antwort mit Link
    → Channel erstellen + Permission Overwrites setzen
    → DB-Eintrag anlegen
    → Welcome-Embed + Buttons posten
    → Log-Eintrag
```

### Ticket schließen — Flow

```
Button "🔒 Schließen" ODER /ticket-close
  → Berechtigung prüfen
  → ephemeral Bestätigungs-Embed mit 2 Buttons
    → "Ja, schließen" → Channel löschen → DB updaten → Log
    → "Abbrechen" → Embed entfernen
```

### Buttons im Ticket-Channel

| customId-Prefix | Aktion |
|---|---|
| `ticket_close` | Schließen starten |
| `ticket_claim` | Ticket claimen |
| `ticket_add_prompt` | Modal für User hinzufügen |
| `ticket_remove_prompt` | Modal für User entfernen |

---

## Permission-System

### Rollen-Hierarchie

- `ADMIN_ROLE_IDS` — dürfen alles
- `SUPPORT_ROLE_IDS` — dürfen Ticket-Commands + Moderation
- `WHITELIST_ROLE_ID` — wird per Regelakzeptanz vergeben

### permissionService.ts

- `isAdmin(member)` — Admin-Rolle oder `Administrator`-Permission
- `isSupport(member)` — Support-Rolle
- `isTicketOwner(member, ticket)` — `member.id === ticket.opener_user_id`
- `canModerateTicket(member, ticket)` — isSupport OR isAdmin OR isTicketOwner
- `canSetup(member)` — isAdmin OR ManageGuild-Permission

### Channel Permission Overwrites

```
@everyone        → Deny: ViewChannel
Ticket-Ersteller → Allow: ViewChannel, SendMessages, AttachFiles, ReadMessageHistory
Support-Rollen   → Allow: ViewChannel, SendMessages, ManageMessages, ReadMessageHistory
Admin-Rollen     → Allow: ViewChannel, SendMessages, ManageMessages, ReadMessageHistory
Bot              → Allow: ViewChannel, SendMessages, ManageChannels, ReadMessageHistory
```

---

## UI / Design-System

### Farbpalette

```typescript
COLORS = {
  primary:       0x5865F2,  // Discord Blurple
  success:       0x57F287,  // Grün
  warning:       0xFEE75C,  // Gelb
  danger:        0xED4245,  // Rot
  neutral:       0x2B2D31,  // Dunkelgrau
  premiumAccent: 0xEB459E,  // Pink/Magenta
}
```

### embedService.ts

- `createTicketPanelEmbed()` — premiumAccent
- `createTicketWelcomeEmbed(user, category)` — primary
- `createRulesEmbed()` — premiumAccent
- `createCloseConfirmEmbed()` — warning
- `createLogEmbed(event, data)` — je Event-Typ
- `createErrorEmbed(msg)` — danger
- `createSuccessEmbed(msg)` — success

### Ticket-Kategorien (in constants.ts konfigurierbar)

```
🔧 Allgemeiner Support
💻 Technisches Problem
🚨 Report / Melden
📋 Whitelist-Frage
📝 Bewerbung / Team
❓ Sonstiges
```

### Button-Styles

- 🔒 Schließen → Danger
- 📌 Claim → Secondary
- 👤 User hinzufügen/entfernen → Secondary

---

## Konfiguration (.env)

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
TICKET_PANEL_CHANNEL_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
RULES_CHANNEL_ID=
WHITELIST_ROLE_ID=
SUPPORT_ROLE_IDS=id1,id2
ADMIN_ROLE_IDS=id3,id4
DATABASE_PATH=./data/bot.db
```

---

## Akzeptanzkriterien

- TypeScript kompiliert ohne Fehler
- Bot startet ohne Runtime Error
- `/setup-tickets` postet Panel mit Select Menu
- Select Menu erstellt privaten Ticket-Channel
- Doppel-Ticket wird verhindert (ephemeral Hinweis)
- Ticket-Channel ist korrekt abgeschottet (@everyone kein Zugriff)
- Ticket kann geschlossen werden (Bestätigung → Löschen)
- Log-Channel empfängt alle Events
- `/setup-rules` postet Regelwerk
- Akzeptieren-Button vergibt Whitelist-Rolle
- Buttons/Select Menus funktionieren nach Bot-Neustart
- Alle Fehlerfälle geben verständliche ephemeral Antworten
