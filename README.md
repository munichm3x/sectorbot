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

## Sector 13 Old Man Lore Bot

A dedicated Discord channel hosts an in-universe SCUM character — "The Old Man of Sector 13". He responds to every message in that channel in character: dark, short, atmospheric. He never breaks character.

### Enable the lore channel

1. Copy the channel ID from Discord (right-click the channel → **Copy Channel ID**)
2. Add it to your `.env`:

```
LORE_CHANNEL_ID=your_channel_id_here
```

3. Restart the bot.

### Install Ollama (optional, for AI-generated replies)

Ollama runs a local language model on your machine. Without it, the bot uses handcrafted fallback lines.

1. Download and install Ollama from [ollama.com](https://ollama.com)
2. Pull the model:

```bash
ollama pull llama3.1:8b
```

3. Start the Ollama server:

```bash
ollama serve
```

The bot connects to `http://localhost:11434/api/generate` by default. Override with:

```
OLLAMA_URL=http://your-host:11434/api/generate
OLLAMA_MODEL=llama3.1:8b
```

### Fallback mode

If Ollama is not running, times out, or returns an empty response, the bot automatically falls back to a pool of handcrafted in-character lines. The bot will still respond — just without AI generation. No configuration needed.

### In-channel commands

| Command | Effect |
|---|---|
| `/story` | The Old Man tells a fictional Sector 13 survival story |
| `/wisdom` | One piece of short, dark survival wisdom |
| `/rumor` | A dark, believable rumor from the SCUM world |
| `/name` | Gives you a dark survivor nickname |

Any other message receives an in-character reply.

### `.env` reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `LORE_CHANNEL_ID` | Yes | — | Channel ID where the Old Man responds |
| `OLLAMA_URL` | No | `http://localhost:11434/api/generate` | Ollama API endpoint |
| `OLLAMA_MODEL` | No | `llama3.1:8b` | Ollama model name |

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
