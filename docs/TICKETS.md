# Ticket-System — Dokumentation

## 1. Ticket-Lifecycle

```
Erstellt (open)
  └─→ Übernommen (open + claimed_by IS NOT NULL)
        └─→ Geschlossen (status='closed', close_reason gesetzt)
              └─→ Archiviert (archived_at gesetzt, Transkript gespeichert)
```

Ein Ticket durchläuft immer diese Phasen:
1. **Erstellt:** Nutzer öffnet Ticket via Select-Menu im Panel-Channel
2. **Optional übernommen:** Support-Mitglied klickt "Übernehmen" → `claimed_by` wird gesetzt, Embed aktualisiert
3. **Geschlossen:** `ticket_confirm_close`-Button → Close-Reason-Modal (min 10 Zeichen) → Ticket wird geschlossen
4. **Archiviert:** `archiveTicket()` läuft beim Schließen — erstellt AI-Summary, HTML-Transkript, postet Archive-Card in Discord

Auto-Close: nach 24h Inaktivität automatisch mit Reason "Auto-close: Keine Aktivität (24 Stunden)".

## 2. Datenmodell

### Tabelle `tickets`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | INTEGER PK | Auto-Increment ID |
| `guild_id` | TEXT | Discord Guild ID |
| `channel_id` | TEXT UNIQUE | Discord Channel ID des Ticket-Channels |
| `opener_user_id` | TEXT | Discord User ID des Erstellers |
| `category` | TEXT | Kategorie-Key (aus `ticket_category_config`) |
| `status` | TEXT | `'open'` oder `'closed'` |
| `claimed_by` | TEXT | Discord User ID des Bearbeiters (NULL = unklaimed) |
| `created_at` | INTEGER | Unix-Timestamp (Erstellungszeitpunkt) |
| `closed_at` | INTEGER | Unix-Timestamp (Schließzeitpunkt) |
| `last_activity_at` | INTEGER | Unix-Timestamp der letzten Nachricht |
| `closed_by` | TEXT | Discord User ID des Schließenden |
| `message_count` | INTEGER | Anzahl Nachrichten beim Schließen |
| `summary` | TEXT | AI-generierte Zusammenfassung |
| `archive_message_id` | TEXT | Message-ID der Archive-Card |
| `archive_channel_id` | TEXT | Channel-ID des Archiv-Channels |
| `username_snapshot` | TEXT | Username-Snapshot des Erstellers |
| `closed_by_username_snapshot` | TEXT | Username-Snapshot des Schließenden |
| `priority` | TEXT | `'low'`\|`'medium'`\|`'high'`\|`'urgent'` (Default: `'medium'`) |
| `close_reason` | TEXT | Pflicht-Schließgrund (ab Update 2026-05-22) |
| `tags` | TEXT | Kommaseparierte Tags (max 5 à 20 Zeichen) |
| `transcript_path` | TEXT | Relativer Pfad: `transcripts/<guild_id>/<id>.html` |
| `archived_at` | INTEGER | Unix-Timestamp der Archivierung |
| `welcome_message_id` | TEXT | Message-ID des Welcome-Embeds (für Embed-Updates) |

### Tabelle `ticket_notes`

Interne Notizen des Support-Teams — nicht für den Ticket-Ersteller sichtbar.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | INTEGER PK | Auto-Increment ID |
| `ticket_id` | INTEGER FK | Referenz auf `tickets.id` |
| `guild_id` | TEXT | Discord Guild ID (für Guild-Isolation) |
| `author_id` | TEXT | Discord User ID des Notiz-Autors |
| `author_tag` | TEXT | Username-Snapshot des Autors |
| `content` | TEXT | Notiz-Inhalt (max 1000 Zeichen) |
| `created_at` | INTEGER | Unix-Timestamp |

## 3. Prioritäten

| Wert | Emoji | Bedeutung |
|------|-------|-----------|
| `low` | 🟢 | Kein zeitlicher Druck |
| `medium` | 🟡 | Standard (Default) |
| `high` | 🔴 | Zeitkritisch |
| `urgent` | 🚨 | Sofortiger Handlungsbedarf |

**Priorität setzen:** Support-Mitglied klickt "🔺 Priorität" im Welcome-Embed → Select-Menu erscheint ephemeral → Auswahl aktualisiert Embed und DB.

## 4. Transcripts

- **Format:** Selbst-enthaltendes HTML, inline styles, kein JavaScript, keine externen Abhängigkeiten
- **Speicherort:** `data/transcripts/<guild_id>/<ticket_id>.html`
- **In DB:** `tickets.transcript_path = 'transcripts/<guild_id>/<ticket_id>.html'`
- **Zugriff:** Dashboard → Ticket-Detail → "📄 Transcript öffnen" (öffnet in neuem Tab)
- **Maximale Nachrichten:** 500 (ältere Tickets können kürzer sein)
- **Fehlerverhalten:** Non-critical — schlägt die Generierung fehl, wird `transcript_path = NULL` gelassen, das Ticket wird trotzdem geschlossen
- **Disk Space:** Keine automatische Bereinigung — manuell über Filesystem

## 5. Interne Notizen

- **Zweck:** Interne Kommunikation des Support-Teams — nicht für Ticket-Ersteller sichtbar
- **Berechtigung:** Support/Admin im Discord (via `canModerateTicket`); Dashboard: `PermLevel.Moderator`
- **Notiz hinzufügen (Discord):** "📝 Notiz"-Button im Welcome-Embed → Modal → gespeichert in `ticket_notes`
- **Notiz löschen (Dashboard):** Nur `PermLevel.Admin` — `DELETE /api/tickets/:id/notes/:noteId`
- **Multiple Notizen:** Beliebig viele Notizen pro Ticket, chronologisch sortiert

## 6. Admin-Aktionen

| Aktion | Berechtigung | Weg |
|--------|-------------|-----|
| Priorität setzen | Support/Admin | "🔺 Priorität" Button im Ticket-Channel |
| Notiz hinzufügen | Support/Admin | "📝 Notiz" Button im Ticket-Channel |
| Ticket schließen | Support/Admin/Owner | "🔒 Schließen" → Confirm → Close-Reason-Modal |
| Notiz löschen | Admin | Dashboard → Ticket-Detail |
| Transcript ansehen | Moderator | Dashboard → Ticket-Detail → Transcript-Button |

## 7. Dashboard-Archiv

**Filter-Parameter (GET /api/tickets):**

| Parameter | Typ | Beispiel |
|-----------|-----|---------|
| `status` | string | `open`, `closed`, `all` |
| `priority` | string | `high`, `urgent` |
| `category` | string | `ban` |
| `claimed_by` | string | Discord User ID |
| `creator` | string | Discord User ID |
| `date_from` | YYYY-MM-DD | `2026-01-01` |
| `date_to` | YYYY-MM-DD | `2026-05-22` |
| `tags` | string | Enthält-Suche |
| `search` | string | Freitext-Suche |
| `page` | number | `1` |

## 8. AI-Interface (TicketContext)

`TicketContext` ist eine strukturierte Schnittstelle für AI-Provider-Austausch in `ticketSummaryService.ts`:

```ts
interface TicketContext {
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
```

Erstellt via `buildTicketContext(ticket, messages)`. Aktuell intern genutzt, zukünftig: Provider-Austausch durch Austausch der `generateTicketSummary`-Implementierung ohne Änderungen an Aufrufer.
