# SCUM Status Dashboard — Design Spec

**Datum:** 2026-05-18  
**Status:** Genehmigt  
**Ansatz:** Feature-Modul (wie Changelog-Dashboard)

---

## Übersicht

Ein persistentes SCUM-Server-Status-Dashboard für Discord. Der Bot postet genau eine Embed-Nachricht pro Guild in einem konfigurierten Channel und editiert diese automatisch in einem konfigurierbaren Intervall. Die Konfiguration erfolgt über den bestehenden `/setup`-Wizard.

---

## Architektur

### Neue Dateien

```
src/
├── features/
│   └── scumStatus/
│       ├── scumStatus.service.ts     # DB-Zugriff, Query-Logik
│       ├── scumStatus.embed.ts       # Embed-Builder (Online/Offline)
│       └── scumStatus.updater.ts     # Zentraler Update-Loop
├── interactions/
│   ├── buttons/
│   │   └── setup/
│   │       └── scumStatusSetupHandler.ts   # Wizard-Buttons für SCUM-Setup
│   └── modals/
│       └── scumStatusModals.ts             # Handler für Host+Port und Intervall-Modals
```

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/db/schema.ts` | Neue Tabelle `scum_status_config` |
| `src/index.ts` | `setupScumStatus(client)` + Modal-Handler + Button-Handler registrieren |
| `src/interactions/buttons/setup/setupDispatcher.ts` | Neue Button-Prefixe routen |
| `src/interactions/channelSelects/setupChannelSelectDispatcher.ts` | Case für `scum_status_channel` ergänzen |
| `src/services/embedService.ts` | Wizard-Step-Embed für SCUM-Status-Seite |

### Neue Dependency

```
gamedig        # Server-Query via Steam/A2S-Protokoll (inkl. eigene TypeScript-Typen in v4)
```

---

## Datenbank-Schema

```sql
CREATE TABLE IF NOT EXISTS scum_status_config (
  guild_id              TEXT PRIMARY KEY,
  enabled               INTEGER NOT NULL DEFAULT 1,
  channel_id            TEXT NOT NULL,
  message_id            TEXT,
  host                  TEXT NOT NULL,
  query_port            INTEGER NOT NULL,
  update_interval_secs  INTEGER NOT NULL DEFAULT 60,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### TypeScript-Interface

```typescript
interface ScumStatusConfig {
  guild_id: string;
  enabled: boolean;
  channel_id: string;
  message_id: string | null;
  host: string;
  query_port: number;
  update_interval_secs: number;
}
```

### Service-Methoden (`scumStatus.service.ts`)

| Methode | Beschreibung |
|---|---|
| `getConfig(guildId)` | Konfiguration lesen |
| `upsertConfig(guildId, data)` | Erstellen oder aktualisieren |
| `setMessageId(guildId, messageId)` | messageId nach erstem Post speichern |
| `setEnabled(guildId, enabled)` | Dashboard aktivieren/deaktivieren |
| `getAllActive()` | Alle Guilds mit `enabled=1` für Update-Loop |

---

## GameDig-Integration

SCUM nutzt das **Steam/A2S-Query-Protokoll**. In gamedig v4 lautet der Type `"scum"`.

```typescript
import Gamedig from 'gamedig';

async function queryServer(host: string, port: number): Promise<QueryResult> {
  const state = await Gamedig.query({
    type: 'scum',   // Fallback: 'protocol-valve' falls 'scum' nicht unterstützt
    host,
    port,
    requestRules: false,
  });
  return {
    online: true,
    serverName: state.name,
    players: state.players.length,
    maxPlayers: state.maxplayers,
    ping: state.ping,
  };
}
```

**Fehler:** Jeder Query-Fehler → `{ online: false }`. Kein Crash, intern geloggt.

---

## Update-Loop

### Datenstruktur

```typescript
const activeIntervals = new Map<string, NodeJS.Timeout>(); // guildId → Timeout
```

### Startup-Flow

1. `getAllActive()` → alle konfigurierten Guilds laden
2. Pro Guild: `startInterval(guildId, config)` aufrufen
3. `startInterval` prüft: Interval aktiv? → vorher stoppen
4. `setInterval(updateDashboard, intervalMs)` starten
5. Sofort erste Aktualisierung ohne auf erstes Intervall zu warten

### `updateDashboard(guildId)` pro Tick

```
1. Config aus DB laden (damit Config-Änderungen wirksam werden)
2. queryServer(host, port)
3. buildEmbed(queryResult)
4. channel.messages.fetch(messageId)
   ├── Erfolg → message.edit(embed)
   ├── Message fehlt (404/10008) → neue Nachricht senden, setMessageId() aufrufen
   └── Channel fehlt (50001/10003) → setEnabled(false), Interval stoppen, loggen
```

### Mindest-Intervall

30 Sekunden. Werte unter 30s werden beim `upsertConfig` auf 30 geclampt.

---

## Setup-Wizard-Integration

### Neuer Button auf Wizard-Startseite (Step 0)

```
[ 🖥️ SCUM-Server-Status ]
```

### SCUM-Status-Wizard-Seite (Embed)

Zeigt den aktuellen Konfigurationsstatus:

```
🖥️ SCUM-Server-Status

Server:    149.202.xx.xx:27015   (oder "Nicht konfiguriert")
Channel:   #server-status         (oder "Nicht konfiguriert")
Intervall: 60 Sekunden
Status:    ✅ Aktiv / ⚪ Nicht eingerichtet / ⏹️ Deaktiviert
```

### Buttons auf der SCUM-Setup-Seite

| Button | Custom ID Prefix | Aktion |
|---|---|---|
| `📡 Channel auswählen` | `scum_status_channel_select` | Channel-Select-Menu öffnen |
| `⚙️ Server konfigurieren` | `scum_status_config_modal` | Modal: Host + Query-Port |
| `🕐 Intervall setzen` | `scum_status_interval_modal` | Modal: Sekunden (min. 30) |
| `▶️ Dashboard erstellen` | `scum_status_create` | Postet Embed, startet Loop |
| `🔄 Neu erstellen` | `scum_status_recreate` | Löscht alte Nachricht, erstellt neue |
| `⏹️ Deaktivieren` | `scum_status_disable` | `enabled=false`, Interval stoppen |
| `← Zurück` | `scum_status_back` | Zurück zu Wizard-Startseite |

### Berechtigungsprüfung beim "Dashboard erstellen"

```typescript
const required = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'];
const missing = required.filter(p => !channel.permissionsFor(guild.members.me).has(p));
if (missing.length > 0) {
  // Ephemeral Fehlermeldung mit Liste der fehlenden Berechtigungen
}
```

---

## Embed-Design

### Online

```
Titel:       🖥️ Sector 13
Beschreibung: 🟢 Online
Felder:
  👥 Spieler     (inline): 12 / 64
  🏓 Ping        (inline): 43 ms
  🕐 Letzte Aktualisierung: <t:TIMESTAMP:R>
Farbe:       #57F287 (Discord-Grün)
Footer:      Automatisches Server-Dashboard
Timestamp:   Discord-Timestamp des letzten Updates
```

### Offline

```
Titel:       🖥️ Sector 13
Beschreibung: 🔴 Offline
Felder:
  👥 Spieler     (inline): Nicht verfügbar
  🏓 Ping        (inline): Nicht verfügbar
  🕐 Letzte Aktualisierung: <t:TIMESTAMP:R>
Farbe:       #ED4245 (Discord-Rot)
Footer:      Automatisches Server-Dashboard
Timestamp:   Discord-Timestamp des letzten Updates
```

Servername (wenn gamedig ihn liefert) als zweite Zeile in der Beschreibung unter dem Status-Icon.

---

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| Query-Timeout/-Fehler | Server als Offline anzeigen, intern loggen |
| Discord 404 (Message gelöscht) | Neue Nachricht erstellen, messageId speichern |
| Discord 10003 (Channel gelöscht) | `enabled=false` setzen, Interval stoppen, loggen |
| Discord Rate Limit | Discord.js handhabt intern, kein extra Code nötig |
| Bot-Neustart | Alle aktiven Configs laden, Loops neu starten |
| Doppelter Interval-Start | Map prüfen → vorherigen Interval stoppen bevor neuer startet |

---

## Konfiguration

Keine globalen Env-Vars nötig. Alles wird pro Guild in der DB gespeichert.

`.env.example` erhält einen Kommentar-Block:
```
# SCUM Status Dashboard
# Konfiguration erfolgt per /setup → SCUM-Server-Status
# Wird pro Guild in der Datenbank gespeichert
```

---

## Akzeptanzkriterien

- [ ] Admin öffnet `/setup` → Button "SCUM-Server-Status" sichtbar
- [ ] Admin konfiguriert Channel, Host, Port → Dashboard erstellen
- [ ] Bot postet genau eine Embed-Nachricht
- [ ] Bot editiert dieselbe Nachricht automatisch (kein Spam)
- [ ] Nach Bot-Neustart: dieselbe Nachricht wird weiter aktualisiert
- [ ] Server offline → Embed zeigt 🔴 Offline
- [ ] Server online → Embed zeigt 🟢 Online
- [ ] Nachricht gelöscht → Bot erstellt neue, kein Crash
- [ ] Channel gelöscht → Dashboard deaktiviert, kein Crash
- [ ] Kein Memory Leak (Map verhindert doppelte Intervals)
- [ ] Kein unhandled promise rejection
- [ ] Mindestintervall 30s wird erzwungen
