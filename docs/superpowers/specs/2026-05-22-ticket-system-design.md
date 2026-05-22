# Ticket-System Verbesserung — Design Spec

**Datum:** 2026-05-22  
**Scope:** `src/services/`, `src/interactions/`, `src/db/`, `src/dashboard/routes/api/`, `dashboard/`, `docs/`  
**Ansatz:** Inkrementeller Layered-Ansatz — bestehende Tabellen und Services werden erweitert, keine Breaking Changes.

---

## Problemstellung

Das bestehende Ticket-System funktioniert grundlegend, fehlt aber an:
- Prioritäten und Tags zur Klassifizierung
- Pflicht-Closing-Reason für Audit-Trail
- Echten Transkript-Dateien (aktuell nur Archive-Card in Discord)
- Internen Notizen für Support-Team
- Erweiterten Dashboard-Filtern (aktuell nur Status + Freitext-Suche)
- Sichtbarer Priorität/Status im Discord-Channel-Embed

---

## Bestehender Funktionsumfang (Baseline)

- Ticket erstellen via Select-Menu, schließen/archivieren/claimen via Commands + Buttons
- AI-Summary (Groq + Keyword-Fallback) beim Schließen
- Auto-Close nach 24h Inaktivität
- Archive-Card in Discord-Channel + interaktives In-Discord-Archiv-Dashboard
- Öffentliche API für eigene Tickets (`/public-api/tickets/mine`)
- Dashboard-API (`GET /api/tickets`, `GET /api/tickets/:id`) mit Status-Filter und Freitext-Suche

---

## Ziele

1. Datenmodell um `priority`, `close_reason`, `tags`, `transcript_path`, `archived_at` erweitern
2. Neue `ticket_notes`-Tabelle für interne Notizen (mehrere Einträge mit Timestamp)
3. HTML-Transkripte beim Schließen generieren und lokal speichern
4. Discord-UX verbessern: Priorität-Button, Notiz-Button, Close-Reason-Modal, aktualisiertes Embed
5. Dashboard-Filter erweitern: Priorität, Kategorie, Ersteller, Zeitraum, Tags
6. Transcript-Viewer + Notizen-Verwaltung im Dashboard
7. Saubere `TicketContext`-Schnittstelle für AI-Integration vorbereiten
8. Tests + `docs/TICKETS.md`

**Nicht geändert:** Bestehende Ticket-Funktionen, vorhandene Ticketdaten, Status-Feldwerte (`'open'`/`'closed'`), bestehende Tests.

---

## Section 1: Datenmodell

### 1.1 Neue Spalten in `tickets` (via ALTER TABLE)

```sql
ALTER TABLE tickets ADD COLUMN priority        TEXT    NOT NULL DEFAULT 'medium';
ALTER TABLE tickets ADD COLUMN close_reason    TEXT;
ALTER TABLE tickets ADD COLUMN tags            TEXT;
ALTER TABLE tickets ADD COLUMN transcript_path TEXT;
ALTER TABLE tickets ADD COLUMN archived_at     INTEGER;
```

| Spalte | Typ | Default | Beschreibung |
|--------|-----|---------|-------------|
| `priority` | TEXT | `'medium'` | `'low'`\|`'medium'`\|`'high'`\|`'urgent'` — manuell durch Support |
| `close_reason` | TEXT | NULL | Pflichtfeld beim Schließen (erfasst via Modal) |
| `tags` | TEXT | NULL | Kommasepariert, z.B. `'ban,steam-id'` (max 5 Tags à 20 Zeichen) |
| `transcript_path` | TEXT | NULL | Relativer Pfad: `transcripts/<guild_id>/<ticket_id>.html` |
| `archived_at` | INTEGER | NULL | Unix Timestamp bei Archivierung (separat von `closed_at`) |

**Status-Semantik** (kein neues Feld, abgeleitet):
- `status='open'` + `claimed_by IS NULL` → Offen
- `status='open'` + `claimed_by IS NOT NULL` → Übernommen
- `status='closed'` → Geschlossen/Archiviert

### 1.2 Neue Tabelle: `ticket_notes`

```sql
CREATE TABLE IF NOT EXISTS ticket_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  guild_id   TEXT    NOT NULL,
  author_id  TEXT    NOT NULL,
  author_tag TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket_id ON ticket_notes(ticket_id);
```

### 1.3 Transcript-Speicherung

- **Pfad:** `data/transcripts/<guild_id>/<ticket_id>.html`
- **In DB:** `tickets.transcript_path = 'transcripts/<guild_id>/<ticket_id>.html'` (relativer Pfad)
- **Format:** Selbst-enthaltendes HTML, inline styles, kein JavaScript, kein externer CSS
- **Fehler:** Non-critical — schlägt Transcript-Generierung fehl, bleibt `transcript_path = NULL`, Ticket wird trotzdem geschlossen

---

## Section 2: Neue & erweiterte Services

### 2.1 `src/services/ticketTranscriptService.ts` (neu)

```ts
export interface TranscriptMessage {
  authorId:        string;
  authorTag:       string;
  authorIsBot:     boolean;
  authorIsSupport: boolean;
  content:         string;
  attachments:     { name: string; url: string; size: number }[];
  timestamp:       Date;
}

export async function generateTranscript(
  ticket:    Ticket,
  messages:  TranscriptMessage[],
  guildName: string,
  dataDir:   string   // process.cwd() + '/data' in production
): Promise<string>    // gibt relativen Pfad zurück: 'transcripts/<guild_id>/<id>.html'
```

**HTML-Inhalt** (keine externen Abhängigkeiten):
- **Header:** Ticket-ID, Kategorie, Priorität, Status, Ersteller, Closer, Close-Reason, Zeitraum, Dauer
- **Teilnehmer:** Deduplizierte Liste aus Messages mit Rolle (Bot / Support / User)
- **Nachrichtenprotokoll:** Chronologisch, Timestamp + Autor + Inhalt + Attachment-Links
- **Footer:** Generierungszeitpunkt

**Verzeichnis-Erstellung:** `fs.mkdirSync(dir, { recursive: true })` vor dem Schreiben.

### 2.2 `src/services/ticketNotesService.ts` (neu)

```ts
export interface TicketNote {
  id:        number;
  ticketId:  number;
  guildId:   string;
  authorId:  string;
  authorTag: string;
  content:   string;
  createdAt: Date;
}

export async function addNote(
  ticketId:  number,
  guildId:   string,
  authorId:  string,
  authorTag: string,
  content:   string
): Promise<TicketNote>

export async function getNotes(ticketId: number, guildId: string): Promise<TicketNote[]>

export async function deleteNote(noteId: number, guildId: string): Promise<void>
```

### 2.3 Änderungen an bestehenden Services

**`ticketService.ts`:**
- `openTicket()` — optionaler `priority`-Parameter (default `'medium'`)
- `closeTicket()` — neuer Pflichtparameter `closeReason: string`, weitergegeben an `archiveTicket()`
- `setPriority(channelId: string, priority: string, setBy: GuildMember): Promise<void>` — neu

**`ticketArchiveService.ts`:**
- Ruft `generateTranscript()` auf nach Summary-Generierung
- Speichert `transcript_path` via `enrichTicketClose()`
- Setzt `archived_at` auf aktuellen Timestamp
- Übergibt `close_reason` an DB-Funktion

**`ticketSummaryService.ts`:**

```ts
// Neu: strukturierte Schnittstelle für AI-Provider-Austausch
export interface TicketContext {
  ticketId:     number;
  category:     string;
  priority:     string;
  createdAt:    Date;
  closedAt:     Date | null;
  closeReason:  string | null;
  participants: { userId: string; tag: string; isSupport: boolean }[];
  messageCount: number;
  messages:     MessageEntry[];
}

export function buildTicketContext(ticket: Ticket, messages: MessageEntry[]): TicketContext
```

`generateTicketSummary()` — Signatur bleibt rückwärtskompatibel, nutzt intern `TicketContext`.

### 2.4 DB-Funktionen (Ergänzungen in `src/db/index.ts`)

```ts
// Ticket
setTicketPriority(channelId: string, priority: string): void
setTicketCloseReason(channelId: string, reason: string): void
setTicketTags(channelId: string, tags: string): void
setTranscriptPath(channelId: string, path: string): void
setArchivedAt(channelId: string, timestamp: number): void

// Erweiterte Abfragen
getFilteredTickets(guildId: string, filters: TicketFilters, limit: number, offset: number): Ticket[]
countFilteredTickets(guildId: string, filters: TicketFilters): number

interface TicketFilters {
  status?:    string;
  priority?:  string;
  category?:  string;
  claimedBy?: string;
  creator?:   string;
  dateFrom?:  number;  // Unix timestamp
  dateTo?:    number;
  tags?:      string;
  search?:    string;
}

// Notizen
createTicketNote(data: Omit<TicketNote, 'id' | 'createdAt'>): TicketNote
getTicketNotes(ticketId: number, guildId: string): TicketNote[]
deleteTicketNote(noteId: number, guildId: string): void
```

---

## Section 3: Discord UX

### 3.1 Close-Reason Modal

**Geänderter Handler:** `src/interactions/buttons/confirmClose.ts`  
Statt direktem `closeTicket()`-Aufruf → `interaction.showModal()`.

**Neues Modal:** `src/interactions/modals/ticketCloseReasonModal.ts`
- `customId`: `ticket_close_reason:{channelId}`
- Pflicht-Textfeld „Schließgrund" (min 10, max 500 Zeichen)
- Submit-Handler ruft `closeTicket(guild, channelId, member, reason)` auf

**Registrierung:** `src/bootstrap/registerInteractions.ts` — neues Modal mit Prefix `ticket_close_reason` eintragen.

### 3.2 Priorität setzen

**Neuer Button** im Welcome-Embed: `🔺 Priorität` → `ticket_priority_prompt:{channelId}`

**Neues Select-Menu:** `src/interactions/selectMenus/ticketPrioritySelect.ts`
- Prefix: `ticket_priority`
- 4 Optionen: 🟢 Low / 🟡 Medium / 🔴 High / 🚨 Urgent
- Nur Support/Admin (Check via `canModerateTicket`)
- Nach Auswahl: `setPriority()` + Embed-Update + ephemeral Bestätigung

### 3.3 Interne Notiz Button

**Neuer Button** im Welcome-Embed: `📝 Notiz` → `ticket_note_prompt:{channelId}`  
Nur sichtbar/nutzbar für Support/Admin.

**Neues Modal:** `src/interactions/modals/ticketNoteModal.ts`
- Prefix: `ticket_note`
- Textfeld (max 1000 Zeichen)
- Submit: `ticketNotesService.addNote()` + ephemeral Bestätigung

### 3.4 Welcome-Embed (aktualisiert)

Neues Embed-Layout in `ticketService.openTicket()`:

```
🎫 Ticket #42                        [Kategorie-Emoji + Label]
──────────────────────────────────────────────────────────────
Ersteller    @MaxMuster
Priorität    🟡 Medium
Status       🟢 Offen
──────────────────────────────────────────────────────────────
Eröffnet     22.05.2026 18:30 Uhr

[🔒 Schließen] [📌 Claimen] [👤 Hinzufügen] [🚫 Entfernen] [🔺 Priorität] [📝 Notiz]
```

Nach `claimTicket()`: Embed per `message.edit()` aktualisieren — Status → `📌 Übernommen von @SupportMember`.  
Nach `setPriority()`: Embed per `message.edit()` aktualisieren — Priorität-Zeile aktualisiert.

**Embed-Message-ID speichern:** Neue Spalte `welcome_message_id TEXT` in `tickets`-Tabelle, damit `message.edit()` möglich ist.

---

## Section 4: Dashboard

### 4.1 Erweiterte API (`src/dashboard/routes/api/tickets.routes.ts`)

**`GET /api/tickets`** — neue Query-Parameter:

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `priority` | string | `low`\|`medium`\|`high`\|`urgent` |
| `category` | string | Kategorie-Key |
| `claimed_by` | string | Discord User ID |
| `creator` | string | Discord User ID |
| `date_from` | string | ISO-Datum (YYYY-MM-DD) |
| `date_to` | string | ISO-Datum (YYYY-MM-DD) |
| `tags` | string | Tag (enthält-Suche) |

Bestehende Parameter (`status`, `page`, `search`, `limit`) bleiben unverändert.

Response-Objekte neu: `priority`, `close_reason`, `tags`, `has_transcript` (boolean), `archived_at`.

**`GET /api/tickets/:id`** — Response erweitert:
- `close_reason`, `priority`, `tags`, `archived_at`
- `notes: TicketNote[]`
- `has_transcript: boolean`

**`GET /api/tickets/:id/transcript`** — neu:
- Liest `data/transcripts/<guild_id>/<ticket_id>.html`
- Content-Type: `text/html; charset=utf-8`
- 404 wenn `transcript_path = NULL` oder Datei nicht vorhanden
- Auth: `PermLevel.Moderator`

**`POST /api/tickets/:id/notes`** — neu:
- Body: `{ content: string }` (1–1000 Zeichen, Zod-validiert)
- Auth: `PermLevel.Moderator`

**`DELETE /api/tickets/:id/notes/:noteId`** — neu:
- Auth: `PermLevel.Admin`

### 4.2 Frontend (bestehende Tickets-Seite erweitert)

- **Filter-Panel:** Dropdowns für Status, Priorität, Kategorie; Datumsbereich-Felder; Tags-Freitext
- **Priorität-Badge:** Farbige Badges in der Ticket-Liste und Detailansicht
- **Detailansicht neu:** Close-Reason, Priorität, Tags, Notizen-Liste, „Notiz hinzufügen"-Formular
- **Transcript-Button:** `📄 Transcript öffnen` → `window.open('/api/tickets/:id/transcript')`

---

## Section 5: Permissions

| Aktion | Berechtigung |
|--------|-------------|
| Priorität setzen (Discord) | `canModerateTicket` (Support/Admin) |
| Notiz hinzufügen (Discord) | `canModerateTicket` (Support/Admin) |
| Notiz löschen (Dashboard) | `PermLevel.Admin` |
| Transcript ansehen | `PermLevel.Moderator` |
| Erweiterte Filter | `PermLevel.Moderator` |
| Ticket-Ersteller: eigenes Ticket sehen | öffentliche API bereits vorhanden |

---

## Section 6: Tests

| Datei | Abdeckung |
|-------|-----------|
| `src/services/__tests__/ticketTranscriptService.test.ts` | HTML enthält Metadaten, Nachrichten, Teilnehmer; keine Secrets im Output; Verzeichnis wird erstellt |
| `src/services/__tests__/ticketNotesService.test.ts` | Notiz erstellen/lesen/löschen; Guild-Isolation (andere Guild sieht Notizen nicht) |
| `src/db/__tests__/ticketMigration.test.ts` | Neue Spalten nach `initDb(':memory:')` vorhanden; ALTER TABLE idempotent; bestehende Daten erhalten |
| `src/dashboard/__tests__/ticketsApi.test.ts` | Filter-Parameter, Transcript-Endpoint (200/404), Notizen-API (POST/DELETE), Auth-Checks |

Bestehende Tests (`scumStatus`, `security`, `bootstrap`) laufen unverändert.

---

## Section 7: `docs/TICKETS.md`

Abschnitte:
1. **Ticket-Lifecycle** — Statusübergänge: open → claimed → closed (mit Reason) → archived
2. **Datenmodell** — alle Felder der `tickets`-Tabelle + `ticket_notes`
3. **Prioritäten & Tags** — Bedeutung, wie setzen
4. **Transcripts** — Format, Speicherort (`data/transcripts/`), Zugriff via Dashboard
5. **Interne Notizen** — wer darf, wie hinzufügen, wie im Dashboard sehen
6. **Admin-Aktionen** — Priorität setzen, Notiz hinzufügen, Archiv durchsuchen
7. **Dashboard-Archiv** — Filter, Transcript-Viewer, Notizen-Verwaltung
8. **AI-Interface** — `TicketContext`-Schnittstelle, Provider-Austausch

---

## Datei-Map

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `src/db/schema.ts` | Modify | ALTER TABLE + ticket_notes CREATE TABLE |
| `src/db/index.ts` | Modify | Neue DB-Funktionen (Filter, Notes, Priority, Transcript) |
| `src/services/ticketTranscriptService.ts` | **Create** | HTML-Transcript generieren und speichern |
| `src/services/ticketNotesService.ts` | **Create** | Interne Notizen CRUD |
| `src/services/ticketService.ts` | Modify | closeReason-Parameter, setPriority(), openTicket() welcome_message_id |
| `src/services/ticketArchiveService.ts` | Modify | Transcript + archived_at integrieren |
| `src/services/ticketSummaryService.ts` | Modify | TicketContext-Interface + buildTicketContext() |
| `src/interactions/buttons/confirmClose.ts` | Modify | showModal() statt direktem closeTicket() |
| `src/interactions/modals/ticketCloseReasonModal.ts` | **Create** | Close-Reason-Pflichtfeld |
| `src/interactions/modals/ticketNoteModal.ts` | **Create** | Interne-Notiz-Modal |
| `src/interactions/selectMenus/ticketPrioritySelect.ts` | **Create** | Priorität-Auswahl |
| `src/bootstrap/registerInteractions.ts` | Modify | Neue Modals + Select-Menu registrieren |
| `src/dashboard/routes/api/tickets.routes.ts` | Modify | Erweiterte Filter + Transcript + Notes Endpoints |
| `dashboard/` (Frontend) | Modify | Filter-Panel, Badges, Notizen, Transcript-Button |
| `src/services/__tests__/ticketTranscriptService.test.ts` | **Create** | Transcript-Tests |
| `src/services/__tests__/ticketNotesService.test.ts` | **Create** | Notizen-Tests |
| `src/db/__tests__/ticketMigration.test.ts` | **Create** | Migration-Tests |
| `src/dashboard/__tests__/ticketsApi.test.ts` | **Create** | Dashboard-API-Tests |
| `docs/TICKETS.md` | **Create** | Dokumentation |

**Unverändert:** alle anderen Commands, Features, Analytics, Bootstrap-Module, Auth-System.

---

## Offene Risiken

1. **Embed-Edit bei älteren Tickets:** `welcome_message_id` kann für bereits bestehende Tickets nicht nachträglich befüllt werden — `message.edit()` schlägt stillschweigend fehl wenn NULL. Abgesichert durch NULL-Check vor Edit.
2. **Transcript-Dateigröße:** Bei sehr langen Tickets (viele Nachrichten) kann das HTML groß werden. Mitigation: Max 500 Nachrichten im Transcript.
3. **Disk-Space:** Transkripte auf Dateisystem akkumulieren sich. Kein automatisches Cleanup in dieser Version — dokumentiert.
4. **ALTER TABLE Idempotenz:** SQLite `ALTER TABLE ADD COLUMN` schlägt fehl wenn Spalte bereits existiert. Absicherung via `IF NOT EXISTS`-Wrapper oder try/catch in Migration.
