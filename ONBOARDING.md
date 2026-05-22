# SectorBot – Streamer Live Announcement System

## Übersicht

Das Streamer-System überwacht automatisch Twitch- und YouTube-Kanäle von Servermitgliedern und sendet Ankündigungen in einen konfigurierten Channel, sobald jemand live geht. Nachrichten werden während des Streams aktuell gehalten und beim Offline-Gehen automatisch abgeschlossen.

---

## Voraussetzungen

Bevor das Setup gestartet wird, werden folgende API-Zugangsdaten benötigt:

### Twitch (Pflicht)

1. Gehe auf [dev.twitch.tv/console](https://dev.twitch.tv/console) und melde dich an.
2. Klicke auf **Register Your Application**.
3. Name: beliebig (z. B. `MeinServerBot`), OAuth Redirect URL: `http://localhost`, Category: `Chat Bot`.
4. Klicke auf **Manage** → notiere **Client ID** und generiere einen **Client Secret**.

### YouTube (Optional)

1. Gehe auf [console.cloud.google.com](https://console.cloud.google.com).
2. Erstelle ein neues Projekt → **APIs & Services** → **Bibliothek** → **YouTube Data API v3** aktivieren.
3. **APIs & Services** → **Anmeldedaten** → **Anmeldedaten erstellen** → **API-Schlüssel**.
4. Notiere den API-Schlüssel.

> **Hinweis:** YouTube ist optional. Das System funktioniert auch mit reiner Twitch-Integration.

---

## Initiales Setup — 7-Schritte-Wizard

Starte den Wizard mit `/streamer` (nur für Admins mit **Server verwalten**-Berechtigung).

Der Wizard ist **30 Minuten** gültig. Brich ihn nicht ab — er läuft sonst ab und muss neu gestartet werden.

### Schritt 1 — Streamer-Rolle

Wähle die Rolle, die Streamer auf dem Server erhalten. Der Bot überwacht **nur Mitglieder mit dieser Rolle**. Mitglieder ohne die Rolle werden nicht geprüft, auch wenn sie in der Streamer-Liste eingetragen sind.

> Erstelle vorher eine dedizierte Rolle (z. B. `🎮 Streamer`) und vergib sie manuell an die Streamer.

### Schritt 2 — Live-Announcement-Channel

Wähle den Text-Channel, in den Live-Ankündigungen gepostet werden. Der Bot benötigt dort **Nachrichten senden**, **Einbettungen senden** und **Nachrichten verwalten**.

### Schritt 3 — Twitch API-Zugangsdaten

Klicke auf **🟣 Twitch-Daten eintragen**. Es öffnet sich ein Modal mit zwei Pflichtfeldern:

```
┌─────────────────────────────────────────┐
│  Twitch API-Zugangsdaten                │
│                                         │
│  Twitch Client ID                       │
│  ┌───────────────────────────────────┐  │
│  │ abc123xyz...                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Twitch Client Secret                   │
│  ┌───────────────────────────────────┐  │
│  │ def456uvw...                      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Client ID** und **Client Secret** findest du so:
1. [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) öffnen
2. Deine App anklicken → **Manage**
3. **Client ID** steht direkt sichtbar auf der Seite
4. Unter **Client Secret** auf **New Secret** klicken → Secret einmalig anzeigen und sofort kopieren

> Die Zugangsdaten gelten **serverübergreifend für alle Streamer** auf diesem Discord-Server und werden nach dem Speichern niemals mehr angezeigt — nur ein `✅ Verbunden` im Dashboard zeigt an, dass sie hinterlegt sind.

### Schritt 4 — YouTube API-Key (optional)

Klicke auf **🔴 YouTube-Key eintragen**. Es öffnet sich ein Modal:

```
┌─────────────────────────────────────────┐
│  YouTube API-Key                        │
│                                         │
│  YouTube Data API v3 Key                │
│  ┌───────────────────────────────────┐  │
│  │ AIzaSy...                         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Oder klicke **Überspringen** — YouTube kann jederzeit später im Dashboard unter **🔧 Plattformen/API** nachgetragen werden.

### Schritt 5 — Prüf-Intervall

Legt fest, wie oft der Bot den Live-Status prüft. Standard: **120 Sekunden**, Minimum: **60 Sekunden**.

> Bei vielen Streamern und einem niedrigen Intervall können Twitch/YouTube API-Rate-Limits erreicht werden. 120–300 Sekunden sind für die meisten Server optimal.

### Schritt 6 — Ping-Typ

Wähle, wer beim Live-Gehen gepingt wird:

| Option | Beschreibung |
|--------|-------------|
| **Streamer-Rolle** | Pingt alle Mitglieder mit der konfigurierten Streamer-Rolle |
| **@everyone** | Pingt alle Servermitglieder |
| **@here** | Pingt alle aktuell online sichtbaren Mitglieder |
| **Kein Ping** | Nur die Embed-Nachricht, kein Ping |

### Schritt 7 — Zusammenfassung & Abschluss

Überprüfe alle Einstellungen. Dann wählen:
- **Aktivieren & Abschließen** → System startet sofort
- **Deaktiviert speichern** → Einstellungen gespeichert, System bleibt aus (später im Dashboard einschaltbar)

---

## Dashboard

Nach dem Setup öffnet `/streamer` direkt das Dashboard. Nur der Admin der die Nachricht geöffnet hat kann damit interagieren.

```
╔══════════════════════════════════════════╗
║  🖥️ Streamer-System — ServerName         ║
║                                          ║
║  Status:          🟢 Aktiv               ║
║  Streamer-Rolle:  @Streamer              ║
║  Live-Channel:    #announcements         ║
║  Intervall:       120s                   ║
║  Ping:            Streamer-Rolle         ║
║  Twitch:          ✅ Verbunden           ║
║  YouTube:         ✅ Verbunden           ║
║  Streamer:        3 gespeichert / 3 aktiv║
║  Letzter Check:   vor 2 Minuten          ║
╚══════════════════════════════════════════╝

[ 🔴 System deaktivieren ] [ ⚙️ Grundeinstellungen ] [ 👥 Streamer verwalten ] [ 🔧 Plattformen/API ]
[ 📢 Testnachricht ] [ 📋 Streamer-Liste ] [ 🔄 Aktualisieren ]
```

### Dashboard-Buttons

| Button | Funktion |
|--------|----------|
| **🟢/🔴 System aktivieren/deaktivieren** | Schaltet das gesamte Live-Checking ein oder aus |
| **⚙️ Grundeinstellungen** | Ändert Rolle, Channel, Intervall oder Ping-Typ |
| **👥 Streamer verwalten** | Fügt Streamer hinzu, bearbeitet oder entfernt sie |
| **🔧 Plattformen/API** | Twitch/YouTube API-Keys aktualisieren |
| **📢 Testnachricht** | Sendet eine `[TEST]`-Ankündigung in den Live-Channel zur Vorschau |
| **📋 Streamer-Liste** | Zeigt alle gespeicherten Streamer mit Live-Status |
| **🔄 Aktualisieren** | Lädt das Dashboard neu |

---

## Grundeinstellungen

Erreichbar über **⚙️ Grundeinstellungen** im Dashboard.

| Option | Beschreibung |
|--------|-------------|
| **🎭 Streamer-Rolle ändern** | Neue Rolle per Role-Select wählen |
| **📢 Live-Channel ändern** | Neuen Channel per Channel-Select wählen |
| **⏱ Intervall ändern** | Prüf-Intervall in Sekunden (min. 60) |
| **🔔 Ping-Typ ändern** | Ping bei Live-Announcements anpassen |

---

## Streamer verwalten

Erreichbar über **👥 Streamer verwalten** im Dashboard.

### Streamer hinzufügen

Streamer können jederzeit nach dem Setup über das Dashboard hinzugefügt werden — der Wizard muss dafür nicht erneut durchlaufen werden.

**Ablauf:**

1. `/streamer` → Dashboard öffnet sich
2. **👥 Streamer verwalten** klicken
3. **➕ Hinzufügen** klicken
4. Den Discord-User im User-Select auswählen
5. Ein Modal öffnet sich mit zwei Feldern:

```
┌─────────────────────────────────────────┐
│  Streamer-Plattformen                   │
│                                         │
│  Twitch Username (optional)             │
│  ┌───────────────────────────────────┐  │
│  │ z.B. dein_twitch_name             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  YouTube Channel-ID (optional)          │
│  ┌───────────────────────────────────┐  │
│  │ z.B. UCxxxxxxx                    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

6. Mindestens **ein** Feld ausfüllen (Twitch oder YouTube oder beides)
7. Absenden → Streamer ist sofort aktiv und wird beim nächsten Check geprüft

> **Wichtig:** Der Streamer muss die **Streamer-Rolle** haben, sonst wird er beim Check ignoriert — auch wenn er in der Liste steht.

**Twitch-Benutzername:**
Der exakte Twitch-Anzeigename oder Login-Name (Groß-/Kleinschreibung egal). Zu finden in der Twitch-URL: `twitch.tv/`**dein_name**

**YouTube-Channel-ID finden:**
Die Channel-ID hat immer das Format `UCxxxxxxxxxxxxxxxxxx` (24 Zeichen, beginnt mit `UC`).
- Methode 1: YouTube-Kanal öffnen → URL prüfen. Falls die URL `/channel/UCxxxx` enthält, ist das direkt die ID.
- Methode 2: YouTube-Kanal öffnen → Rechtsklick → Seitenquelltext → nach `"channelId"` oder `"externalId"` suchen.
- Methode 3: [commentpicker.com/youtube-channel-id.php](https://commentpicker.com/youtube-channel-id.php) — Channel-URL eingeben, ID wird angezeigt.

> `@handle`-URLs (`youtube.com/@name`) sind **keine** Channel-IDs — der Bot benötigt zwingend die `UC...`-ID.

### Streamer bearbeiten

Klicke **✏️ Bearbeiten** → Streamer aus der Liste auswählen → Modal öffnet sich mit den aktuell eingetragenen Werten vorausgefüllt → Twitch-Name und/oder YouTube-ID anpassen → Absenden.

Felder die leer gelassen werden bleiben unverändert.

### Streamer deaktivieren / löschen

Klicke **🚫 Deaktivieren** → Streamer auswählen → **Deaktivieren** (bleibt in der Liste, wird nicht mehr geprüft) oder **Löschen** (vollständig entfernen inkl. Live-State).

### Streamer aktivieren

Klicke **✅ Aktivieren** → deaktivierten Streamer auswählen → wird wieder überwacht.

### Sync

Klicke **🔄 Sync** — der Bot vergleicht alle Mitglieder mit der Streamer-Rolle gegen die gespeicherte Liste und zeigt an, wer die Rolle hat aber noch nicht eingetragen ist. Diese können dann manuell über „Hinzufügen" ergänzt werden.

---

## Plattformen & API

Erreichbar über **🔧 Plattformen/API** im Dashboard. Hier können API-Zugangsdaten jederzeit geändert oder ergänzt werden, ohne den Setup-Wizard erneut zu starten.

### 🟣 Twitch API ändern

Klicke **🟣 Twitch API ändern** — es öffnet sich dasselbe Modal wie im Wizard:

```
┌─────────────────────────────────────────┐
│  Twitch API-Zugangsdaten                │
│                                         │
│  Twitch Client ID                       │
│  ┌───────────────────────────────────┐  │
│  │ abc123xyz...                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Twitch Client Secret                   │
│  ┌───────────────────────────────────┐  │
│  │ def456uvw...                      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Beide Felder müssen ausgefüllt werden. Nach dem Speichern wird der gecachte Access-Token automatisch gelöscht — der Bot holt sich beim nächsten Check einen neuen.

**Client ID und Secret finden:** [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → App → Manage → Client ID kopieren, neues Secret generieren.

### 🔴 YouTube API ändern

```
┌─────────────────────────────────────────┐
│  YouTube API-Key                        │
│                                         │
│  YouTube Data API v3 Key                │
│  ┌───────────────────────────────────┐  │
│  │ AIzaSy...                         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**API-Key erstellen:** [console.cloud.google.com](https://console.cloud.google.com) → Projekt → APIs & Services → Anmeldedaten → API-Schlüssel erstellen. Die **YouTube Data API v3** muss in der Bibliothek aktiviert sein.

### YouTube deaktivieren

Entfernt den YouTube-Key vollständig — YouTube-Checks werden bis zur erneuten Einrichtung übersprungen. Twitch läuft weiter.

> API-Keys werden **niemals** im Dashboard oder in Logs angezeigt. Nur `✅ Verbunden` oder `❌ Nicht eingerichtet` zeigt den Status an.

---

## Live Announcements

Wenn ein Streamer live geht, sendet der Bot eine Embed-Nachricht in den konfigurierten Live-Channel:

```
[Ping] 🔔 @Streamer-Rolle

🔴 MaxiStreamer ist jetzt live auf Twitch
MaxiStreamer spielt SCUM

Staffel 2 Folge 1 – Wir überleben!
🎮 SCUM
👥 142 Zuschauer

[ Jetzt zuschauen ]
```

**Während des Streams:** Die Nachricht wird bei jedem Check mit aktuellem Titel und Zuschauerzahl aktualisiert.

**Nach dem Stream:** Wenn der Streamer offline geht, wird die Ankündigung **nicht gelöscht** — sie bleibt als Aufzeichnung erhalten. Beim nächsten Live-Gehen wird eine neue Nachricht gesendet.

**Gelöschte Ankündigung:** Wurde die Nachricht manuell gelöscht, sendet der Bot beim nächsten Live-Gehen automatisch eine neue.

---

## Live-Checker — Technisches Verhalten

| Situation | Verhalten |
|-----------|-----------|
| Streamer geht live | Neue Ankündigung wird gesendet |
| Streamer ist weiterhin live | Nachricht wird aktualisiert (Titel, Zuschauer) |
| Streamer geht offline | Live-State wird zurückgesetzt, Nachricht bleibt |
| Streamer hat keine Rolle | Wird beim Check übersprungen |
| Streamer ist deaktiviert | Wird nicht geprüft |
| API-Fehler (401 Twitch) | Token wird erneuert, einmaliger Retry |
| API-Fehler (YouTube) | Silent fail, nächster Check normal |

---

## Bot-Neustart / Ausfälle

Nach einem Neustart werden alle aktiven Checking-Intervalle automatisch aus der Datenbank wiederhergestellt. Es sind keine manuellen Aktionen notwendig.

Der `last_successful_check`-Zeitstempel im Dashboard zeigt an, wann der letzte erfolgreiche Durchlauf war. Fehler werden unter `⚠️ Letzter Fehler` angezeigt (max. 500 Zeichen).

---

## Häufige Probleme

### Keine Ankündigung obwohl Streamer live ist

**Checkliste:**
1. Hat der Streamer die Streamer-Rolle? → Fehlt die Rolle, wird er nicht geprüft.
2. Ist das System aktiv? → Dashboard → Status muss 🟢 Aktiv sein.
3. Stimmt der Twitch-Benutzername? → Groß-/Kleinschreibung egal, aber Tippfehler prüfen.
4. Sind die API-Keys korrekt? → `🔧 Plattformen/API` → Keys neu eintragen.
5. Ist der Live-Channel korrekt? → `📢 Testnachricht` senden — kommt die Testnachricht an?
6. Hat der Bot im Live-Channel `Nachrichten senden` + `Einbettungen senden`?

### System startet nach Bot-Restart nicht

Wenn `[streamer] 0 Live-Checker gestartet` im Log erscheint: Das Setup wurde gemacht, während der Bot bereits lief. Im Dashboard einmal **🔴 System deaktivieren** und danach **🟢 System aktivieren** klicken — der Checker startet neu.

### Twitch-Fehler im Log

`401 Unauthorized`: Twitch-Token abgelaufen oder Client Secret falsch. Bot erneuert automatisch einmal — tritt der Fehler dauerhaft auf, API-Keys unter `🔧 Plattformen/API` neu eintragen.

`403 Forbidden`: Client ID ungültig oder App gesperrt. Neue Twitch-App anlegen.

### YouTube-Check funktioniert nicht

- Channel-ID muss im Format `UCxxxxxxxxxxxxxxxxxx` sein (nicht `@handle`).
- API-Key muss für `YouTube Data API v3` freigeschaltet sein.
- Tages-Quote der YouTube API (10.000 Units/Tag) prüfen — bei vielen Streamern kann das Limit erreicht werden.

---

## Berechtigungen

| Aktion | Erforderlich |
|--------|-------------|
| `/streamer` ausführen | Discord-Berechtigung **Server verwalten** |
| Dashboard bedienen | Nur der Admin der es geöffnet hat |
| Anderen Admins anzeigen | Neues `/streamer` öffnen |

---

## Kurzreferenz

```
/streamer               → Setup-Wizard (kein Setup) oder Dashboard (Setup vorhanden)

Dashboard
├── ⚙️ Grundeinstellungen
│   ├── Streamer-Rolle ändern
│   ├── Live-Channel ändern
│   ├── Intervall ändern
│   └── Ping-Typ ändern
├── 👥 Streamer verwalten
│   ├── ➕ Hinzufügen    (User-Select → Modal: Twitch + YouTube)
│   ├── ✏️ Bearbeiten    (Auswahl → Modal: Daten ändern)
│   ├── 🚫 Deaktivieren  (Auswahl → Deaktivieren / Löschen)
│   ├── ✅ Aktivieren    (Auswahl → reaktivieren)
│   ├── 📋 Liste         (paginierte Übersicht mit Live-Status)
│   └── 🔄 Sync          (Rolleninhaber vs. Datenbank vergleichen)
└── 🔧 Plattformen/API
    ├── Twitch API neu setzen
    ├── YouTube API neu setzen
    └── YouTube deaktivieren
```
