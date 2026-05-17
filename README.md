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

## Sector 13 Old Man

The Old Man is a legendary survivor who responds to messages in a designated channel on your server. Configure his channel with a slash command; he replies using a local Ollama model (or built-in fallbacks when Ollama is unavailable).

### Setup

1. **Install Ollama**
   ```
   winget install Ollama.Ollama
   ```

2. **Pull the base model**
   ```
   ollama pull llama3.1:8b
   ```

3. **Create the custom model**
   ```
   ollama create sector13-oldman -f Modelfile.oldman
   ```

4. **Test it**
   ```
   ollama run sector13-oldman
   ```

5. **Set environment variables** (optional — these are the defaults)
   ```
   OLLAMA_MODEL=sector13-oldman
   OLLAMA_URL=http://localhost:11434/api/generate
   OLD_MAN_COOLDOWN_MS=5000
   ```

6. **Start the bot**

7. **Configure a channel in Discord**
   ```
   /oldman-channel set #your-channel
   ```

### Slash Commands

| Command | Permission | Description |
|---|---|---|
| `/oldman-channel set #channel` | Manage Server | Designate a channel for the Old Man |
| `/oldman-channel show` | Anyone | Show the currently configured channel |
| `/oldman-channel disable` | Manage Server | Disable the Old Man on this server |

### In-Channel Text Commands

Type these at the start of a message in the Old Man channel:

| Command | Description |
|---|---|
| `/story` | A dark survival story from Sector 13 |
| `/wisdom` | A short piece of dark survival wisdom |
| `/rumor` | A disturbing rumor from this world |
| `/name` | A dark survivor nickname (remembered for the session) |
| `/lastwords` | A final radio transmission from a lost survivor |
| `/prison` | A disturbing observation about the prison island |
| `/bunker` | An atmospheric bunker description |

These are plain text prefixes, not Discord slash commands — just type them in the configured channel.

### Fallback Mode

If Ollama is unavailable or times out, the Old Man replies from a built-in pool of handcrafted responses. Fallback replies are mode-specific: `/wisdom` gets a wisdom fallback, `/rumor` gets a rumor fallback, and so on.

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

## Changelog System

The Changelog System provides a private team dashboard for creating changelogs and a public channel where each published changelog appears as its own standalone embed message.

### Setup

1. Create a **private team channel** (e.g. `#changelog-erstellen`) — only your team should see it.
2. Create a **public channel** (e.g. `#changelog`) — visible to everyone.
3. Run `/setup` and click **Changelog-System**.
4. Use the channel selects to choose the private creation channel and the public changelog channel.
5. Click **Dashboard erstellen** — the bot posts the persistent dashboard in the private channel.

### Creating a Changelog

1. In the private channel, click **Changelog erstellen**.
2. Fill in the modal: Version, Titel (optional), Hinzugefügt, Geändert, Behoben.
3. Review the ephemeral preview embed.
4. Optionally click **Entfernt/Notizen hinzufügen** for a second modal (Entfernt, Notizen).
5. Click **Veröffentlichen** — a new embed appears in the public changelog channel.
6. Each new changelog is its own separate message. Old changelogs are never edited.

### Permissions

Only users with **Manage Guild** (`Server verwalten`) permission can use the dashboard buttons.

### Testing Checklist

- [ ] `/setup` → Changelog-System → select both channels → Dashboard erstellen → dashboard appears in private channel
- [ ] Restarting the bot edits the existing dashboard — no duplicate messages
- [ ] "Changelog erstellen" opens a 5-field modal
- [ ] Each input line becomes one bullet point (`•`)
- [ ] Empty categories are omitted from the embed
- [ ] Preview is ephemeral (only visible to the user who clicked)
- [ ] "Entfernt/Notizen hinzufügen" opens a second modal and updates the preview in place
- [ ] "Veröffentlichen" sends a new message to the public channel
- [ ] Creating a second changelog sends another new message — old ones untouched
- [ ] Users without Manage Guild see the German permission error ephemeral
- [ ] Drafts expire after 30 minutes

---

## Tests

```bash
npm test
```

Tests decken ab: DB-Queries (tickets, guild_config, support_roles, categories), Permission-Checks, ID-Utilities.
