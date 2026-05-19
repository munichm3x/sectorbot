# Streamer Live Announcement System — Design Spec

**Datum:** 2026-05-18
**Status:** Genehmigt, bereit für Implementierung

---

## Ziel

Ein vollständiges Streamer-Live-Announcement-System als neues Feature im bestehenden Discord.js v14 TypeScript-Bot. Alles läuft über einen einzigen Slash-Command `/streamer`. Keine weiteren Slash-Commands.

---

## Entscheidungen (aus Brainstorming)

| Thema | Entscheidung |
|---|---|
| TikTok | Komplett weggelassen — keine stabile öffentliche Live-API |
| Announcement Ping | Konfigurierbar im Dashboard: `none` / `role` / `everyone` / `here` |
| Announcement Updates | Regelmäßig bearbeiten solange der Stream läuft (Zuschauer, Titel) |
| Architektur | Feature-Folder `src/features/streamer/` — analog zu `scumStatus/` |

---

## Dateistruktur

```
src/
  commands/
    streamer.ts                   # /streamer slash command (ManageGuild-Pflicht, ephemeral)

  features/
    streamer/
      streamer.types.ts           # TypeScript-Interfaces für alle Streamer-Typen
      streamer.db.ts              # Alle DB-Queries für alle 3 Tabellen
      streamer.embeds.ts          # Alle EmbedBuilder (Wizard, Dashboard, Announcement)
      streamer.wizard.ts          # Wizard-Steps + In-Memory-State (30-min TTL)
      streamer.dashboard.ts       # Dashboard + alle Untermenü-Handler
      streamer.checker.ts         # Per-Guild Intervall-Scheduler + Check-Logik
      streamer.twitch.ts          # Twitch Helix API (Token-Cache, Stream-Check)
      streamer.youtube.ts         # YouTube Data API (Stream-Check)
```

**Neue Interaktions-Handler** (alle Prefix `str`):
- `streamerButtonHandler` → alle Buttons
- `streamerModalHandler` → alle Modal-Submissions
- `streamerChannelSelectHandler` → Channel-Auswahl
- `streamerRoleSelectHandler` → Rollen-Auswahl
- `streamerUserSelectHandler` → User-Auswahl (**UserSelectMenu — neuer Handler-Typ**)

**Erweiterungen am bestehenden Code:**
- `src/types/index.ts` → `UserSelectMenuHandler`-Interface hinzufügen
- `src/client.ts` → `userSelectHandlers` Map + `interaction.isUserSelectMenu()` routing
- `src/db/schema.ts` → 3 neue CREATE-TABLE-Konstanten
- `src/db/index.ts` → `initDb()` erweitern, neue DB-Funktionen exportieren
- `src/index.ts` → alle neuen Handler registrieren, `setupStreamerChecker(client)` aufrufen

---

## Datenbank

### Tabelle: `streamer_config`

```sql
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
```

`announcement_ping_type`: `'none'` | `'role'` | `'everyone'` | `'here'`

### Tabelle: `streamers`

```sql
CREATE TABLE IF NOT EXISTS streamers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id          TEXT    NOT NULL,
  discord_user_id   TEXT    NOT NULL,
  twitch_username   TEXT    NULL,
  youtube_channel_id TEXT   NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guild_id, discord_user_id)
)
```

### Tabelle: `stream_live_states`

```sql
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
```

`platform`: `'twitch'` | `'youtube'`

`announcement_message_id`: Discord-Message-ID der gesendeten Announcement — wird zum Editieren während der Stream läuft benötigt.

---

## Wizard-Flow (6 Konfigurationsschritte + Zusammenfassung)

```
/streamer → setup_completed=false?
  └─ Wizard öffnen

Schritt 1: RoleSelectMenu   → streamer_role_id speichern
Schritt 2: ChannelSelectMenu → live_channel_id speichern (nur TextChannel)
Schritt 3: Modal (Twitch)   → twitch_client_id + twitch_client_secret speichern
Schritt 4: Modal (YouTube)  → youtube_api_key speichern  ODER  [Überspringen]
Schritt 5: Modal (Intervall) → check_interval_seconds speichern (min. 60, default 120)
Schritt 6: Buttons (Ping)   → [Streamer-Rolle] [everyone] [@here] [Kein Ping]
Schritt 7: Zusammenfassung  → [Aktivieren & Abschließen] [Deaktiviert speichern]
```

**Wizard-State:** In-Memory-Map `"${guildId}:${userId}"` → Partial `streamer_config` mit 30-min TTL. Bot-Neustart während Wizard → `/streamer` erneut ausführen (State verloren, sauberer Neustart).

---

## Dashboard

### Embed-Inhalt

```
🖥️ Streamer-System — [Servername]

Systemstatus:         🟢 Aktiv / 🔴 Inaktiv
Streamer-Rolle:       @Rolle
Live-Channel:         #channel
Prüf-Intervall:       120 Sekunden
Ping-Typ:             Streamer-Rolle / @everyone / @here / Kein Ping
Twitch:               ✅ Verbunden / ❌ Nicht eingerichtet
YouTube:              ✅ Verbunden / ❌ Nicht eingerichtet
Streamer gespeichert: N
Streamer aktiv:       N
Letzter Check:        <t:UNIX:R>
Letzter Fehler:       [Text] / —
```

### Buttons (Zeile 1)
- `[🟢 System deaktivieren]` / `[🔴 System aktivieren]`
- `[⚙️ Grundeinstellungen]`
- `[👥 Streamer verwalten]`
- `[🔧 Plattformen/API]`
- `[📢 Testnachricht]`

### Buttons (Zeile 2)
- `[📋 Streamer-Liste]`
- `[🔄 Aktualisieren]`

---

## Untermenüs

### Grundeinstellungen
Buttons: `[Streamer-Rolle ändern]` `[Live-Channel ändern]` `[Intervall ändern]` `[Ping-Typ ändern]` `[↩ Zurück]`

- Rolle → RoleSelectMenu
- Channel → ChannelSelectMenu
- Intervall → Modal (min. 60s) → `startGuildInterval()` sofort neu starten
- Ping → Buttons: `[Streamer-Rolle]` `[@everyone]` `[@here]` `[Kein Ping]` `[↩ Zurück]`

### Plattformen/API
Buttons: `[Twitch ändern]` `[YouTube ändern]` `[YouTube deaktivieren]` `[↩ Zurück]`

- Twitch → Modal (Client ID + Secret) → Token-Cache leeren
- YouTube → Modal (API Key)
- YouTube deaktivieren → `youtube_api_key = NULL`
- Secrets werden **niemals** im Dashboard angezeigt, **niemals** geloggt

### Streamer verwalten
Buttons: `[➕ Hinzufügen]` `[✏️ Bearbeiten]` `[🚫 Deaktivieren]` `[✅ Aktivieren]` `[📋 Liste]` `[🔄 Sync]` `[↩ Zurück]`

**Hinzufügen:**
1. UserSelectMenu → Discord-User auswählen
2. Modal → `twitch_username` (optional), `youtube_channel_id` (optional)
3. Validierung: mindestens 1 Plattform
4. Speichern in `streamers` mit `enabled=1`
5. Hinweis wenn User die Streamer-Rolle fehlt

**Bearbeiten:**
1. StringSelectMenu mit gespeicherten Streamern (Name als Label, discord_user_id als Value)
2. Modal mit aktuellen Werten vorausgefüllt (soweit möglich)
3. Leere Felder überschreiben nicht — nur ausgefüllte Felder werden aktualisiert

**Deaktivieren/Löschen:**
1. StringSelectMenu (nur enabled=1 Streamer)
2. Bestätigung: `[Deaktivieren]` `[Komplett löschen]` `[Abbrechen]`
3. Deaktivieren → `enabled=0`
4. Löschen → Streamer + zugehörige `stream_live_states` entfernen

**Aktivieren:**
1. StringSelectMenu (nur enabled=0 Streamer)
2. → `enabled=1`

**Liste:**
- Paginiert, 10 Einträge pro Seite
- Pro Eintrag: Discord-User, Twitch (✅/—), YouTube (✅/—), Rolle (✅/❌), Aktiv (✅/❌)
- Aktueller Live-Status pro Plattform
- Buttons: `[◀ Zurück]` `[▶ Vor]` `[↩ Dashboard]`

**Sync (Alle Rollenmitglieder):**
1. Alle Mitglieder mit Streamer-Rolle laden
2. Bereits gespeicherte Streamer filtern
3. StringSelectMenu: "Welche Rollenmitglieder als Streamer anlegen?"
4. Pro ausgewähltem User: Modal für Plattform-Daten
5. User ohne Plattform-Daten werden nicht gespeichert

---

## Live-Checker

### Startup

```typescript
export function setupStreamerChecker(client: Client): void {
  client.once('ready', async () => {
    const configs = getAllActiveStreamerConfigs(); // enabled=1, setup_completed=1
    for (const config of configs) {
      startGuildInterval(client, config.guild_id);
    }
  });
}
```

### Per-Guild-Interval

```
startGuildInterval(client, guildId):
  stopGuildInterval(guildId)        // Bestehenden stoppen
  config = getStreamerConfig(guildId)
  secs = max(config.check_interval_seconds, 60)
  runGuildCheck(client, guildId)    // Sofort einmal ausführen
  interval = setInterval(() => runGuildCheck(client, guildId), secs * 1000)
  activeIntervals.set(guildId, interval)
```

### Check-Logik

```
runGuildCheck(client, guildId):
  config = getStreamerConfig(guildId)
  guard: enabled=1, setup_completed=1, role+channel gesetzt
  
  streamers = getEnabledStreamers(guildId)
  guild = await client.guilds.fetch(guildId)
  
  für jeden streamer:
    member = await guild.members.fetch(streamer.discord_user_id)
    wenn member fehlt: überspringen
    wenn member hat streamer_role_id nicht: überspringen (nicht löschen)
    
    wenn twitch_client_id gesetzt + streamer.twitch_username:
      result = await checkTwitch(config, streamer.twitch_username)
      await handleLiveStateChange(client, config, streamer, 'twitch', result)
    
    wenn youtube_api_key gesetzt + streamer.youtube_channel_id:
      result = await checkYouTube(config, streamer.youtube_channel_id)
      await handleLiveStateChange(client, config, streamer, 'youtube', result)
  
  updateLastSuccessfulCheck(guildId)
  bei Fehler: updateLastError(guildId, err.message)  // kein Crash
```

### State-Übergangs-Logik

```
vorher offline + jetzt live:
  → Announcement-Nachricht SENDEN
  → is_live=1, stream_id, url, title, announcement_message_id speichern

vorher live + noch live:
  → Announcement-Nachricht EDITIEREN (neues Embed mit aktuellen Werten)

vorher live + jetzt offline:
  → is_live=0 setzen
  → announcement_message_id = NULL
  → Nächster Stream → frische Ankündigung
```

---

## Announcement-Embed

```
Farbe: #E74C3C (Rot)
Titel: 🔴 {username} ist jetzt live auf Twitch / YouTube
Beschreibung:
  **{streamtitel}**
  🎮 {spielname}     ← nur wenn vorhanden (Twitch)
  👥 {viewerCount}   ← nur wenn vorhanden
Thumbnail: Stream-Preview-URL (falls von API geliefert)
Button: [🔗 Zum Stream]  (LinkButton → Stream-URL)
Footer: {guildName} · Twitch / YouTube
Timestamp: Date.now()
```

Ping wird als normaler Text **vor** dem Embed gesendet: `content: "@Rolle"` / `"@everyone"` / `"@here"` / `undefined`.

**Test-Embed:** Gleiche Struktur, `content: "[TEST]"`, Titel mit `[TEST]` präfixiert, Ping-Typ wird ignoriert.

---

## Twitch-Integration (`streamer.twitch.ts`)

```typescript
// Token-Cache (in-memory)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(clientId: string, clientSecret: string): Promise<string>
// POST https://id.twitch.tv/oauth2/token?grant_type=client_credentials
// Cache mit expires_in - 60s Puffer

async function checkTwitchStream(config: StreamerConfig, username: string): Promise<LiveResult>
// GET https://api.twitch.tv/helix/streams?user_login={username}
// Rückgabe: { isLive, streamId, title, gameName, viewerCount, thumbnailUrl, startedAt, url }
```

Secrets werden **nie** geloggt. Bei 401 → Token neu holen. Bei Rate-Limit → `{ isLive: false }` + Fehler in `last_error`.

---

## YouTube-Integration (`streamer.youtube.ts`)

```typescript
async function checkYouTubeStream(apiKey: string, channelId: string): Promise<LiveResult>
// GET https://www.googleapis.com/youtube/v3/search
//   ?part=snippet&channelId={channelId}&eventType=live&type=video&key={apiKey}
// Rückgabe: { isLive, videoId, title, thumbnailUrl, startedAt, url }
```

Wenn kein `apiKey` → `{ isLive: false }` ohne Fehler. API-Fehler → `last_error` aktualisieren.

---

## Sicherheit

- `/streamer`: nur mit `ManageGuild`-Permission, immer `ephemeral: true`
- Alle Buttons/Selects/Modals: Permission-Check + `interaction.user.id === userId` aus Custom-ID
- Secrets (`twitch_client_secret`, `youtube_api_key`): niemals vollständig anzeigen, `[GESETZT]` als Platzhalter
- Secrets niemals loggen (nur `[REDACTED]` wenn Debug nötig)
- Bei API-Ausfall: Fehler in `last_error` speichern, kein Bot-Crash, nächster Check läuft normal weiter

---

## Custom-ID-Schema

Alle Interaktionen nutzen Prefix `str`. Payload-Format: `{action}:{guildId}:{userId}[:{extra}]`

Beispiele:
- `str:dashboard:home:{guildId}:{userId}`
- `str:wizard:step:2:{guildId}:{userId}`
- `str:manage:add:select:{guildId}:{userId}`
- `str:modal:twitch:{guildId}:{userId}`
- `str:platforms:ping:role:{guildId}:{userId}`

---

## Integration in bestehenden Bot

`src/index.ts` erhält:
```typescript
import { setupStreamerChecker, streamerButtonHandler, streamerModalHandler,
         streamerChannelSelectHandler, streamerRoleSelectHandler,
         streamerUserSelectHandler } from './features/streamer/...';
import { streamerCommand } from './commands/streamer';

commands.set(streamerCommand.data.name, streamerCommand);
buttonHandlers.set(streamerButtonHandler.prefix, streamerButtonHandler);
modalHandlers.set(streamerModalHandler.prefix, streamerModalHandler);
channelSelectHandlers.set(streamerChannelSelectHandler.prefix, streamerChannelSelectHandler);
roleSelectHandlers.set(streamerRoleSelectHandler.prefix, streamerRoleSelectHandler);
userSelectHandlers.set(streamerUserSelectHandler.prefix, streamerUserSelectHandler);
setupStreamerChecker(client);
```
