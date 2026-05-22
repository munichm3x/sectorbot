# Ticket-System Verbesserung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend sectorbot's ticket system with priority, close reason, tags, HTML transcripts, internal notes, improved Discord UX, and extended dashboard filters — without breaking any existing functionality.

**Architecture:** Inkrementell — bestehende DB-Tabellen werden via ALTER TABLE erweitert, neue `ticket_notes`-Tabelle hinzugefügt. Zwei neue Services (`ticketTranscriptService`, `ticketNotesService`), additive Änderungen an `ticketService`, `ticketArchiveService`, `ticketSummaryService`. Discord-UX: 2 neue Modals, 1 neues Select-Menu, 2 neue Button-Handler. Dashboard-API: 3 neue Endpoints + erweiterte Filter. Alles ist backwards-compatible — ältere Tickets ohne neue Felder funktionieren weiter.

**Tech Stack:** TypeScript, Discord.js v14, better-sqlite3 (synchronous), vitest, supertest, Node.js fs/path, Express 4, Zod

---

## File Map

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `src/db/schema.ts` | Modify | `CREATE_TICKET_NOTES_TABLE` + Index |
| `src/db/index.ts` | Modify | ALTER TABLE Migrationen + 10 neue DB-Funktionen |
| `src/types/index.ts` | Modify | Ticket-Interface um neue Felder erweitern |
| `src/utils/ids.ts` | Modify | 5 neue IDS-Konstanten |
| `src/services/ticketTranscriptService.ts` | Create | HTML-Transkript generieren + speichern |
| `src/services/ticketNotesService.ts` | Create | Interne Notizen CRUD |
| `src/services/ticketSummaryService.ts` | Modify | TicketContext-Interface + buildTicketContext() |
| `src/services/ticketService.ts` | Modify | closeReason-Param, setPriority(), verbessertes Embed, welcome_message_id |
| `src/services/ticketArchiveService.ts` | Modify | Transkript + archived_at integrieren |
| `src/interactions/buttons/confirmClose.ts` | Modify | showModal() statt direktem closeTicket() |
| `src/interactions/modals/ticketCloseReasonModal.ts` | Create | Close-Reason-Pflichtfeld verarbeiten |
| `src/interactions/selectMenus/ticketPrioritySelect.ts` | Create | Priorität-Button-Handler + Select-Menu-Handler |
| `src/interactions/modals/ticketNoteModal.ts` | Create | Notiz-Button-Handler + Modal-Handler |
| `src/bootstrap/registerInteractions.ts` | Modify | Neue Handler registrieren |
| `src/features/ticketAutoClose.ts` | Modify | close_reason für Auto-Close setzen |
| `src/dashboard/routes/api/tickets.routes.ts` | Modify | Erweiterte Filter + Transcript + Notes Endpoints |
| `src/services/__tests__/ticketTranscriptService.test.ts` | Create | Transcript-Tests |
| `src/services/__tests__/ticketNotesService.test.ts` | Create | Notizen-Tests |
| `src/db/__tests__/ticketMigration.test.ts` | Create | Migration-Tests |
| `src/dashboard/__tests__/ticketsApi.test.ts` | Create | Dashboard-API-Tests |
| `docs/TICKETS.md` | Create | Dokumentation |

---

### Task 1: DB-Schema — ticket_notes Tabelle

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Append ticket_notes schema to schema.ts**

Am Ende von `src/db/schema.ts` anfügen:

```ts
export const CREATE_TICKET_NOTES_TABLE = `
  CREATE TABLE IF NOT EXISTS ticket_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
    guild_id   TEXT    NOT NULL,
    author_id  TEXT    NOT NULL,
    author_tag TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  )
`;
export const CREATE_TICKET_NOTES_INDEX = `CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket_id ON ticket_notes(ticket_id)`;
```

- [ ] **Step 2: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(tickets): add ticket_notes table schema"
```

---

### Task 2: DB-Migrationen + Tests (TDD)

**Files:**
- Modify: `src/db/index.ts`
- Create: `src/db/__tests__/ticketMigration.test.ts`

- [ ] **Step 1: Write failing migration test**

Erstelle `src/db/__tests__/ticketMigration.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb, createTicket } from '../index';

describe('ticket migration', () => {
  beforeEach(() => { initDb(':memory:'); });

  it('new ticket columns exist after initDb', () => {
    const info = getDb().prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
    const cols = info.map(c => c.name);
    expect(cols).toContain('priority');
    expect(cols).toContain('close_reason');
    expect(cols).toContain('tags');
    expect(cols).toContain('transcript_path');
    expect(cols).toContain('archived_at');
    expect(cols).toContain('welcome_message_id');
  });

  it('ticket_notes table and index exist', () => {
    const table = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_notes'`)
      .get();
    expect(table).toBeTruthy();
    const idx = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ticket_notes_ticket_id'`)
      .get();
    expect(idx).toBeTruthy();
  });

  it('priority defaults to medium for new tickets', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1',
      category: 'general', created_at: 1000,
    });
    const row = getDb()
      .prepare(`SELECT priority FROM tickets WHERE id = ?`)
      .get(ticket.id) as { priority: string };
    expect(row.priority).toBe('medium');
  });

  it('ALTER TABLE is idempotent — second initDb does not throw', () => {
    expect(() => initDb(':memory:')).not.toThrow();
  });

  it('existing ticket data survives migration', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1',
      category: 'ban', created_at: 5000,
    });
    const row = getDb()
      .prepare(`SELECT * FROM tickets WHERE id = ?`)
      .get(ticket.id) as { id: number; category: string; priority: string };
    expect(row.id).toBe(ticket.id);
    expect(row.category).toBe('ban');
    expect(row.priority).toBe('medium');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/db/__tests__/ticketMigration.test.ts
```

Expected: FAIL — columns do not exist yet.

- [ ] **Step 3: Add migrations to db/index.ts**

In `src/db/index.ts`, import the new schema exports:
```ts
import {
  // ... existing imports ...
  CREATE_TICKET_NOTES_TABLE, CREATE_TICKET_NOTES_INDEX,
} from './schema';
```

In `initDb()`, nach dem Block der bestehenden ALTER TABLE Migrationen (nach Zeile mit `closed_by_username_snapshot`), hinzufügen:

```ts
  // Ticket-System Verbesserungen (2026-05-22)
  try { db.exec(`ALTER TABLE tickets ADD COLUMN priority           TEXT    NOT NULL DEFAULT 'medium'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN close_reason       TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN tags               TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN transcript_path    TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN archived_at        INTEGER`);                           } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN welcome_message_id TEXT`);                              } catch { /* already exists */ }
  db.exec(CREATE_TICKET_NOTES_TABLE);
  db.exec(CREATE_TICKET_NOTES_INDEX);
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/db/__tests__/ticketMigration.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/db/index.ts src/db/__tests__/ticketMigration.test.ts
git commit -m "feat(tickets): add migration for priority/close_reason/tags/transcript_path/archived_at/welcome_message_id + ticket_notes table"
```

---

### Task 3: DB-Funktionen für neue Felder + Notes

**Files:**
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add new DB functions to db/index.ts**

Am Ende von `src/db/index.ts`, vor der letzten Funktion, einfügen:

```ts
// ─── Ticket — neue Felder ─────────────────────────────────────────────────────

export function setTicketPriority(channelId: string, priority: string): void {
  getDb()
    .prepare(`UPDATE tickets SET priority = ? WHERE channel_id = ?`)
    .run(priority, channelId);
}

export function setTicketCloseReason(channelId: string, reason: string): void {
  getDb()
    .prepare(`UPDATE tickets SET close_reason = ? WHERE channel_id = ?`)
    .run(reason, channelId);
}

export function setTicketTags(channelId: string, tags: string): void {
  getDb()
    .prepare(`UPDATE tickets SET tags = ? WHERE channel_id = ?`)
    .run(tags, channelId);
}

export function setTranscriptPath(channelId: string, transcriptPath: string): void {
  getDb()
    .prepare(`UPDATE tickets SET transcript_path = ? WHERE channel_id = ?`)
    .run(transcriptPath, channelId);
}

export function setArchivedAt(channelId: string, timestamp: number): void {
  getDb()
    .prepare(`UPDATE tickets SET archived_at = ? WHERE channel_id = ?`)
    .run(timestamp, channelId);
}

export function setWelcomeMessageId(channelId: string, messageId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET welcome_message_id = ? WHERE channel_id = ?`)
    .run(messageId, channelId);
}

// ─── Ticket — erweiterte Abfragen ─────────────────────────────────────────────

export interface TicketFilters {
  status?:    string;
  priority?:  string;
  category?:  string;
  claimedBy?: string;
  creator?:   string;
  dateFrom?:  number;
  dateTo?:    number;
  tags?:      string;
  search?:    string;
}

function buildTicketFilterQuery(
  guildId: string,
  filters: TicketFilters,
  count = false,
): { sql: string; params: unknown[] } {
  const conditions: string[] = ['guild_id = ?'];
  const params: unknown[]    = [guildId];

  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.claimedBy) {
    conditions.push('claimed_by = ?');
    params.push(filters.claimedBy);
  }
  if (filters.creator) {
    conditions.push('opener_user_id = ?');
    params.push(filters.creator);
  }
  if (filters.dateFrom) {
    conditions.push('COALESCE(closed_at, created_at) >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('COALESCE(closed_at, created_at) <= ?');
    params.push(filters.dateTo);
  }
  if (filters.tags) {
    conditions.push('tags LIKE ?');
    params.push(`%${filters.tags}%`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      '(CAST(id AS TEXT) LIKE ? OR opener_user_id LIKE ? OR closed_by LIKE ? OR ' +
      'category LIKE ? OR summary LIKE ? OR username_snapshot LIKE ? OR closed_by_username_snapshot LIKE ?)'
    );
    params.push(like, like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const sql   = count
    ? `SELECT COUNT(*) AS n FROM tickets WHERE ${where}`
    : `SELECT * FROM tickets WHERE ${where}`;
  return { sql, params };
}

export function getFilteredTickets(
  guildId: string,
  filters: TicketFilters,
  limit:   number,
  offset:  number,
): Ticket[] {
  const { sql, params } = buildTicketFilterQuery(guildId, filters);
  return getDb()
    .prepare(`${sql} ORDER BY COALESCE(closed_at, created_at) DESC LIMIT ? OFFSET ?`)
    .all([...params, limit, offset]) as Ticket[];
}

export function countFilteredTickets(guildId: string, filters: TicketFilters): number {
  const { sql, params } = buildTicketFilterQuery(guildId, filters, true);
  const row = getDb().prepare(sql).get(params) as { n: number };
  return row.n;
}

// ─── Ticket Notes ─────────────────────────────────────────────────────────────

export interface TicketNoteRow {
  id:         number;
  ticket_id:  number;
  guild_id:   string;
  author_id:  string;
  author_tag: string;
  content:    string;
  created_at: number;
}

export function createTicketNote(data: Omit<TicketNoteRow, 'id'>): TicketNoteRow {
  const result = getDb()
    .prepare(`
      INSERT INTO ticket_notes (ticket_id, guild_id, author_id, author_tag, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(data.ticket_id, data.guild_id, data.author_id, data.author_tag, data.content, data.created_at);
  return getDb()
    .prepare(`SELECT * FROM ticket_notes WHERE id = ?`)
    .get(result.lastInsertRowid) as TicketNoteRow;
}

export function getTicketNotes(ticketId: number, guildId: string): TicketNoteRow[] {
  return getDb()
    .prepare(`SELECT * FROM ticket_notes WHERE ticket_id = ? AND guild_id = ? ORDER BY created_at ASC`)
    .all(ticketId, guildId) as TicketNoteRow[];
}

export function deleteTicketNote(noteId: number, guildId: string): void {
  getDb()
    .prepare(`DELETE FROM ticket_notes WHERE id = ? AND guild_id = ?`)
    .run(noteId, guildId);
}
```

Außerdem `enrichTicketClose` erweitern um optionalen `closeReason`-Parameter. Die bestehende Funktion in `db/index.ts` (aktuell Zeilen 216–229) ersetzen:

```ts
export function enrichTicketClose(
  channelId:    string,
  closedBy:     string,
  messageCount: number,
  summary:      string,
  closeReason?: string,
): void {
  getDb()
    .prepare(`
      UPDATE tickets
      SET closed_by = ?, message_count = ?, summary = ?,
          close_reason = COALESCE(?, close_reason)
      WHERE channel_id = ?
    `)
    .run(closedBy, messageCount, summary.slice(0, 2000), closeReason ?? null, channelId);
}
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

```bash
npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/db/index.ts
git commit -m "feat(tickets): add DB functions for priority/notes/transcript/filters + extend enrichTicketClose"
```

---

### Task 4: ticketTranscriptService (TDD)

**Files:**
- Create: `src/services/__tests__/ticketTranscriptService.test.ts`
- Create: `src/services/ticketTranscriptService.ts`

- [ ] **Step 1: Write failing test**

Erstelle `src/services/__tests__/ticketTranscriptService.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { generateTranscript, type TranscriptMessage } from '../ticketTranscriptService';
import type { Ticket } from '../../types/index';

const TMP = join(process.cwd(), 'tmp-transcript-test-' + Date.now());

const TICKET: Ticket = {
  id: 42,
  guild_id: 'g1',
  channel_id: 'c1',
  opener_user_id: 'u1',
  category: 'ban',
  status: 'closed',
  claimed_by: 'u2',
  created_at: 1700000000,
  closed_at:  1700003600,
  closed_by:  'u2',
  close_reason: 'Anfrage bearbeitet',
  priority: 'high',
};

const MESSAGES: TranscriptMessage[] = [
  {
    authorId: 'u1', authorTag: 'Max#0001', authorIsBot: false, authorIsSupport: false,
    content: 'Ich wurde gebannt', attachments: [],
    timestamp: new Date(1700000100 * 1000),
  },
  {
    authorId: 'u2', authorTag: 'Support#9999', authorIsBot: false, authorIsSupport: true,
    content: 'Wir prüfen das',
    attachments: [{ name: 'beweis.png', url: 'https://cdn.example.com/beweis.png', size: 12345 }],
    timestamp: new Date(1700001000 * 1000),
  },
];

describe('ticketTranscriptService', () => {
  beforeEach(() => { mkdirSync(TMP, { recursive: true }); });
  afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

  it('returns relative path and creates the file', async () => {
    const path = await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    expect(path).toBe('transcripts/g1/42.html');
    expect(existsSync(join(TMP, 'transcripts', 'g1', '42.html'))).toBe(true);
  });

  it('HTML contains ticket metadata', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('42');
    expect(html).toContain('ban');
    expect(html).toContain('Anfrage bearbeitet');
    expect(html).toContain('Hoch');
  });

  it('HTML contains message content and author tags', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('Ich wurde gebannt');
    expect(html).toContain('Wir prüfen das');
    expect(html).toContain('Max#0001');
    expect(html).toContain('Support#9999');
  });

  it('HTML contains attachment link', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('beweis.png');
  });

  it('HTML has no external stylesheet or script src', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).not.toMatch(/<link[^>]+href="https?:/i);
    expect(html).not.toMatch(/<script[^>]+src="https?:/i);
  });

  it('creates nested subdirectories automatically', async () => {
    const nested = join(TMP, 'deep', 'nested');
    await generateTranscript(TICKET, MESSAGES, 'Test', nested);
    expect(existsSync(join(nested, 'transcripts', 'g1', '42.html'))).toBe(true);
  });

  it('truncates to max 500 messages', async () => {
    const many: TranscriptMessage[] = Array.from({ length: 600 }, (_, i) => ({
      authorId: 'u1', authorTag: 'User#0001', authorIsBot: false, authorIsSupport: false,
      content: `msg-${i}`, attachments: [], timestamp: new Date(),
    }));
    await generateTranscript(TICKET, many, 'Test', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).not.toContain('msg-500');
    expect(html).toContain('msg-499');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/services/__tests__/ticketTranscriptService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ticketTranscriptService.ts**

Erstelle `src/services/ticketTranscriptService.ts`:

```ts
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Ticket } from '../types/index';

export interface TranscriptMessage {
  authorId:        string;
  authorTag:       string;
  authorIsBot:     boolean;
  authorIsSupport: boolean;
  content:         string;
  attachments:     { name: string; url: string; size: number }[];
  timestamp:       Date;
}

const MAX_MESSAGES = 500;

export async function generateTranscript(
  ticket:    Ticket,
  messages:  TranscriptMessage[],
  guildName: string,
  dataDir:   string,
): Promise<string> {
  const relativePath = `transcripts/${ticket.guild_id}/${ticket.id}.html`;
  const absDir = join(dataDir, 'transcripts', ticket.guild_id);
  mkdirSync(absDir, { recursive: true });

  const capped = messages.slice(0, MAX_MESSAGES);
  const html   = buildHtml(ticket, capped, guildName);
  writeFileSync(join(absDir, `${ticket.id}.html`), html, 'utf-8');
  return relativePath;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTs(ts: Date | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : ts;
  return d.toLocaleString('de-DE', { timeZone: 'UTC' });
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Niedrig', medium: 'Mittel', high: 'Hoch', urgent: 'Dringend',
};

function buildHtml(ticket: Ticket, messages: TranscriptMessage[], guildName: string): string {
  const openedAt   = ticket.created_at;
  const closedAt   = ticket.closed_at ?? Math.floor(Date.now() / 1000);
  const durationS  = closedAt - openedAt;
  const durStr     = durationS < 3600
    ? `${Math.floor(durationS / 60)} Min.`
    : durationS < 86400
      ? `${Math.floor(durationS / 3600)} Std.`
      : `${Math.floor(durationS / 86400)} Tage`;

  const participants = new Map<string, { tag: string; isBot: boolean; isSupport: boolean }>();
  for (const m of messages) {
    if (!participants.has(m.authorId)) {
      participants.set(m.authorId, { tag: m.authorTag, isBot: m.authorIsBot, isSupport: m.authorIsSupport });
    }
  }

  const participantsHtml = [...participants.entries()].map(([id, p]) => {
    const role = p.isBot ? 'Bot' : p.isSupport ? 'Support' : 'Nutzer';
    return `<li>${esc(p.tag)} <span style="color:#888">(${role}, ID: ${esc(id)})</span></li>`;
  }).join('');

  const messagesHtml = messages.map(m => {
    const bg = m.authorIsBot ? '#1a1a2e' : m.authorIsSupport ? '#162032' : '#1e2433';
    const nameColor = m.authorIsSupport ? '#43b581' : '#ccc';
    const attachsHtml = m.attachments.map(a =>
      `<a href="${esc(a.url)}" style="color:#5b8dd9;display:block;margin-top:4px">` +
      `📎 ${esc(a.name)} (${Math.round(a.size / 1024)} KB)</a>`
    ).join('');
    return `
    <div style="background:${bg};border-radius:6px;padding:10px 14px;margin-bottom:6px">
      <div style="display:flex;gap:10px;align-items:baseline">
        <span style="font-weight:600;color:${nameColor}">${esc(m.authorTag)}</span>
        <span style="font-size:.78rem;color:#555">${fmtTs(m.timestamp)}</span>
      </div>
      <div style="margin-top:4px;color:#ddd;white-space:pre-wrap">${esc(m.content)}</div>
      ${attachsHtml}
    </div>`;
  }).join('');

  const reasonHtml = ticket.close_reason
    ? `<div style="grid-column:1/-1"><div class="ml">Schließgrund</div>` +
      `<div class="mv">${esc(ticket.close_reason)}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${ticket.id} — ${esc(guildName)}</title>
<style>
body{margin:0;padding:20px;background:#0f1117;color:#ccc;font-family:system-ui,sans-serif;line-height:1.5}
h1{color:#fff;border-bottom:1px solid #333;padding-bottom:12px}
.meta{background:#161b22;border-radius:8px;padding:16px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ml{color:#888;font-size:.8rem}.mv{color:#e6edf3;font-size:.9rem}
h2{color:#aaa;font-size:1rem;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.05em}
ul{padding-left:20px}a{color:#5b8dd9}
footer{margin-top:30px;padding-top:12px;border-top:1px solid #333;font-size:.75rem;color:#555;text-align:center}
</style>
</head>
<body>
<h1>🎫 Ticket #${ticket.id}</h1>
<div class="meta">
  <div><div class="ml">Server</div><div class="mv">${esc(guildName)}</div></div>
  <div><div class="ml">Kategorie</div><div class="mv">${esc(ticket.category)}</div></div>
  <div><div class="ml">Priorität</div><div class="mv">${PRIORITY_LABEL[ticket.priority ?? 'medium'] ?? (ticket.priority ?? 'medium')}</div></div>
  <div><div class="ml">Status</div><div class="mv">Geschlossen</div></div>
  <div><div class="ml">Ersteller (ID)</div><div class="mv">${esc(ticket.opener_user_id)}</div></div>
  <div><div class="ml">Geschlossen von (ID)</div><div class="mv">${esc(ticket.closed_by ?? '—')}</div></div>
  <div><div class="ml">Geöffnet</div><div class="mv">${fmtTs(openedAt)}</div></div>
  <div><div class="ml">Geschlossen</div><div class="mv">${fmtTs(closedAt)}</div></div>
  <div><div class="ml">Laufzeit</div><div class="mv">${durStr}</div></div>
  <div><div class="ml">Nachrichten</div><div class="mv">${messages.length}</div></div>
  ${reasonHtml}
</div>
<h2>Teilnehmer</h2>
<ul>${participantsHtml}</ul>
<h2>Nachrichtenprotokoll (${messages.length})</h2>
${messagesHtml}
<footer>Generiert am ${fmtTs(new Date())} — ${esc(guildName)} Ticketsystem</footer>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/services/__tests__/ticketTranscriptService.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/ticketTranscriptService.ts src/services/__tests__/ticketTranscriptService.test.ts
git commit -m "feat(tickets): add ticketTranscriptService with HTML generation"
```

---

### Task 5: ticketNotesService (TDD)

**Files:**
- Create: `src/services/__tests__/ticketNotesService.test.ts`
- Create: `src/services/ticketNotesService.ts`

- [ ] **Step 1: Write failing test**

Erstelle `src/services/__tests__/ticketNotesService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, createTicket } from '../../db/index';
import { addNote, getNotes, deleteNote } from '../ticketNotesService';

let ticketId: number;

beforeEach(() => {
  initDb(':memory:');
  const t = createTicket({
    guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1',
    category: 'ban', created_at: 1000,
  });
  ticketId = t.id;
});

describe('addNote', () => {
  it('creates and returns a note with correct fields', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Testnotiz');
    expect(note.id).toBeGreaterThan(0);
    expect(note.ticketId).toBe(ticketId);
    expect(note.guildId).toBe('g1');
    expect(note.authorId).toBe('a1');
    expect(note.authorTag).toBe('Admin#0001');
    expect(note.content).toBe('Testnotiz');
    expect(note.createdAt).toBeInstanceOf(Date);
  });
});

describe('getNotes', () => {
  it('returns notes in chronological order', async () => {
    await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Erste Notiz');
    await addNote(ticketId, 'g1', 'a2', 'Mod#0002', 'Zweite Notiz');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(2);
    expect(notes[0]!.content).toBe('Erste Notiz');
    expect(notes[1]!.content).toBe('Zweite Notiz');
  });

  it('returns empty array when no notes exist', async () => {
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(0);
  });

  it('guild isolation — other guild sees no notes', async () => {
    await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Nur für g1');
    const notes = await getNotes(ticketId, 'g2');
    expect(notes).toHaveLength(0);
  });
});

describe('deleteNote', () => {
  it('removes the note', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Zu löschen');
    await deleteNote(note.id, 'g1');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(0);
  });

  it('is no-op for wrong guild', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Bleibt');
    await deleteNote(note.id, 'g2');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/services/__tests__/ticketNotesService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ticketNotesService.ts**

Erstelle `src/services/ticketNotesService.ts`:

```ts
import {
  createTicketNote, getTicketNotes, deleteTicketNote as dbDeleteNote,
  type TicketNoteRow,
} from '../db/index';

export interface TicketNote {
  id:        number;
  ticketId:  number;
  guildId:   string;
  authorId:  string;
  authorTag: string;
  content:   string;
  createdAt: Date;
}

function toNote(row: TicketNoteRow): TicketNote {
  return {
    id:        row.id,
    ticketId:  row.ticket_id,
    guildId:   row.guild_id,
    authorId:  row.author_id,
    authorTag: row.author_tag,
    content:   row.content,
    createdAt: new Date(row.created_at * 1000),
  };
}

export async function addNote(
  ticketId:  number,
  guildId:   string,
  authorId:  string,
  authorTag: string,
  content:   string,
): Promise<TicketNote> {
  const row = createTicketNote({
    ticket_id:  ticketId,
    guild_id:   guildId,
    author_id:  authorId,
    author_tag: authorTag,
    content,
    created_at: Math.floor(Date.now() / 1000),
  });
  return toNote(row);
}

export async function getNotes(ticketId: number, guildId: string): Promise<TicketNote[]> {
  return getTicketNotes(ticketId, guildId).map(toNote);
}

export async function deleteNote(noteId: number, guildId: string): Promise<void> {
  dbDeleteNote(noteId, guildId);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/services/__tests__/ticketNotesService.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/ticketNotesService.ts src/services/__tests__/ticketNotesService.test.ts
git commit -m "feat(tickets): add ticketNotesService with guild-isolated CRUD"
```

---

### Task 6: Ticket-Typ + IDS + TicketContext

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/ids.ts`
- Modify: `src/services/ticketSummaryService.ts`

- [ ] **Step 1: Extend Ticket interface in types/index.ts**

Die bestehende `Ticket`-Interface in `src/types/index.ts` um neue Felder erweitern. Direkt nach `closed_by_username_snapshot` hinzufügen:

```ts
  // Ticket-System Verbesserungen (migration columns — null on older records)
  priority?:           string | null;
  close_reason?:       string | null;
  tags?:               string | null;
  transcript_path?:    string | null;
  archived_at?:        number | null;
  welcome_message_id?: string | null;
```

- [ ] **Step 2: Add new IDS constants to ids.ts**

In `src/utils/ids.ts`, das `IDS`-Objekt um folgende Felder erweitern (nach `ACCEPT_RULES`):

```ts
  TICKET_PRIORITY_PROMPT:    'ticket_priority_prompt',
  TICKET_PRIORITY:           'ticket_priority',
  TICKET_NOTE_PROMPT:        'ticket_note_prompt',
  TICKET_NOTE_MODAL:         'ticket_note',
  TICKET_CLOSE_REASON_MODAL: 'ticket_close_reason',
```

- [ ] **Step 3: Add TicketContext to ticketSummaryService.ts**

In `src/services/ticketSummaryService.ts` die folgenden Exporte nach den bestehenden Interfaces (`MessageEntry`, `SummaryResult`) hinzufügen:

```ts
import type { Ticket } from '../types/index';

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

export function buildTicketContext(ticket: Ticket, messages: MessageEntry[]): TicketContext {
  const participants = [
    ...new Map(
      messages
        .filter(m => !m.isBot)
        .map(m => [
          m.authorId,
          { userId: m.authorId, tag: m.authorName, isSupport: m.authorId !== ticket.opener_user_id },
        ])
    ).values(),
  ];
  return {
    ticketId:     ticket.id,
    category:     ticket.category,
    priority:     ticket.priority ?? 'medium',
    createdAt:    new Date(ticket.created_at * 1000),
    closedAt:     ticket.closed_at ? new Date(ticket.closed_at * 1000) : null,
    closeReason:  ticket.close_reason ?? null,
    participants,
    messageCount: messages.length,
    messages,
  };
}
```

Achtung: `Ticket` ist bereits in der Datei implizit verfügbar über den bestehenden `import type { Ticket } from '../types';` — diesen vorhandenen Import prüfen und ggf. anpassen auf `'../types/index'` oder `'../types'` (beides funktioniert).

- [ ] **Step 4: Run build to verify no type errors**

```bash
npm run build 2>&1 | head -30
```

Expected: keine TypeScript-Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/ids.ts src/services/ticketSummaryService.ts
git commit -m "feat(tickets): extend Ticket type, add IDS constants, add TicketContext"
```

---

### Task 7: ticketService.ts — Embed-Update + closeReason + setPriority + welcome_message_id

**Files:**
- Modify: `src/services/ticketService.ts`

- [ ] **Step 1: Add imports**

Am Anfang von `src/services/ticketService.ts` folgende Imports ergänzen/aktualisieren:

```ts
import { EmbedBuilder } from 'discord.js';
import { SECTOR_COLORS } from '../ui/brand';
import {
  createTicket as dbCreateTicket,
  findTicketByChannel,
  closeTicket as dbCloseTicket,
  claimTicket as dbClaimTicket,
  setTicketPriority as dbSetTicketPriority,
  setTicketCloseReason,
  setWelcomeMessageId,
} from '../db/index';
```

Den bestehenden Import `import { createTicketWelcomeEmbed } from './embedService';` entfernen (wird durch neue Hilfsfunktion ersetzt).

- [ ] **Step 2: Add buildTicketWelcomeEmbed helper**

Nach den Error-Klassen, vor `openTicket()`, folgende Hilfsfunktionen einfügen:

```ts
const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🔴', urgent: '🚨',
};

function buildTicketWelcomeEmbed(
  member:   GuildMember,
  catLabel: string,
  ticketId: number,
  priority: string,
): EmbedBuilder {
  const prioEmoji = PRIORITY_EMOJI[priority] ?? '🟡';
  const prioLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle(`🎫 Ticket #${ticketId}`)
    .addFields(
      { name: 'Ersteller',  value: `<@${member.id}>`,               inline: true },
      { name: 'Priorität',  value: `${prioEmoji} ${prioLabel}`,     inline: true },
      { name: 'Status',     value: '🟢 Offen',                      inline: true },
      { name: 'Kategorie',  value: catLabel,                         inline: false },
    )
    .setFooter({ text: 'Beschreibe dein Anliegen möglichst genau. Das Support-Team meldet sich hier.' });
}

export async function updateWelcomeEmbed(guild: import('discord.js').Guild, channelId: string): Promise<void> {
  const ticket = findTicketByChannel(channelId);
  if (!ticket?.welcome_message_id) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const catLabel   = ticket.category;
  const priority   = ticket.priority ?? 'medium';
  const prioEmoji  = PRIORITY_EMOJI[priority] ?? '🟡';
  const prioLabel  = priority.charAt(0).toUpperCase() + priority.slice(1);
  const claimedEmbed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle(`🎫 Ticket #${ticket.id}`)
    .addFields(
      { name: 'Ersteller',  value: `<@${ticket.opener_user_id}>`,             inline: true },
      { name: 'Priorität',  value: `${prioEmoji} ${prioLabel}`,               inline: true },
      { name: 'Status',     value: ticket.claimed_by ? `📌 Übernommen von <@${ticket.claimed_by}>` : '🟢 Offen', inline: true },
      { name: 'Kategorie',  value: catLabel,                                   inline: false },
    )
    .setFooter({ text: 'Beschreibe dein Anliegen möglichst genau. Das Support-Team meldet sich hier.' });

  try {
    const msg = await channel.messages.fetch(ticket.welcome_message_id).catch(() => null);
    if (msg) await msg.edit({ embeds: [claimedEmbed] });
  } catch {
    // Non-critical — embed update failure must not prevent ticket operations
  }
}
```

- [ ] **Step 3: Update openTicket() — new embed + 2 action rows + save welcome_message_id**

In `openTicket()`, die bestehende Erstellung von `row` und `welcomeEmbed` ersetzen:

```ts
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLOSE, channel.id))
      .setLabel('Schließen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLAIM, channel.id))
      .setLabel('Übernehmen')
      .setEmoji('📌')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_ADD_PROMPT, channel.id))
      .setLabel('Hinzufügen')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_REMOVE_PROMPT, channel.id))
      .setLabel('Entfernen')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_PRIORITY_PROMPT, channel.id))
      .setLabel('Priorität')
      .setEmoji('🔺')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_NOTE_PROMPT, channel.id))
      .setLabel('Notiz')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary),
  );
  const welcomeEmbed = buildTicketWelcomeEmbed(member, catLabel, ticket.id, 'medium');
```

Und den `channel.send()`-Aufruf so ändern, dass er beide Rows schickt und die message-ID speichert:

```ts
  try {
    const welcomeMsg = await channel.send({ embeds: [welcomeEmbed], components: [row1, row2] });
    setWelcomeMessageId(channel.id, welcomeMsg.id);
  } catch (sendErr) {
    // ... bestehende Fehlerbehandlung bleibt unverändert ...
```

- [ ] **Step 4: Update closeTicket() — add closeReason parameter**

Die bestehende `closeTicket`-Signatur ändern:

```ts
export async function closeTicket(
  guild:       Guild,
  channelId:   string,
  closedBy:    GuildMember,
  closeReason = 'Manuell geschlossen',
): Promise<void> {
```

Und direkt nach dem `logEvent`-Aufruf, vor `archiveTicket`, einfügen:
```ts
  setTicketCloseReason(channelId, closeReason);
```

Und den `archiveTicket`-Aufruf um `closeReason` ergänzen:
```ts
  await archiveTicket(guild, channelId, ticket, closedBy.id, closeReason);
```

- [ ] **Step 5: Add setPriority() function**

Am Ende von `ticketService.ts` hinzufügen:

```ts
export async function setPriority(
  guild:     import('discord.js').Guild,
  channelId: string,
  priority:  string,
): Promise<void> {
  dbSetTicketPriority(channelId, priority);
  await updateWelcomeEmbed(guild, channelId);
}
```

- [ ] **Step 6: Update claimTicket() to refresh embed**

Am Ende der bestehenden `claimTicket()`-Funktion, vor dem `return true`, einfügen:

```ts
  await updateWelcomeEmbed(guild, channelId).catch(() => void 0);
```

- [ ] **Step 7: Run build**

```bash
npm run build 2>&1 | head -30
```

Expected: keine Fehler. Falls der Import von `createTicketWelcomeEmbed` noch fehlt oder doppelt ist: bereinigen.

- [ ] **Step 8: Commit**

```bash
git add src/services/ticketService.ts
git commit -m "feat(tickets): update openTicket embed (2 rows, priority/note buttons), add setPriority, add closeReason param"
```

---

### Task 8: ticketArchiveService.ts — Transkript + archived_at

**Files:**
- Modify: `src/services/ticketArchiveService.ts`

- [ ] **Step 1: Add imports**

Am Anfang von `src/services/ticketArchiveService.ts` hinzufügen:

```ts
import { join } from 'path';
import { generateTranscript, type TranscriptMessage } from './ticketTranscriptService';
import {
  setTranscriptPath, setArchivedAt,
} from '../db/index';
```

- [ ] **Step 2: Update archiveTicket signature to accept closeReason**

```ts
export async function archiveTicket(
  guild:       Guild,
  channelId:   string,
  ticket:      Ticket | undefined,
  closedById:  string,
  closeReason?: string,
): Promise<void> {
```

- [ ] **Step 3: Update _archive to pass closeReason to enrichTicketClose and generate transcript**

In der privaten `_archive`-Funktion die Signatur ändern:

```ts
async function _archive(
  guild:       Guild,
  channelId:   string,
  ticket:      Ticket | undefined,
  closedById:  string,
  closeReason?: string,
): Promise<void> {
```

Und den `archiveTicket`-Aufruf in der öffentlichen Wrapper-Funktion entsprechend anpassen:
```ts
    await _archive(guild, channelId, ticket, closedById, closeReason);
```

Im `_archive`-Body, nach der Summary-Generierung (Step 4 — "Enrich DB record"), die `enrichTicketClose`-Zeile ersetzen:

```ts
      enrichTicketClose(ticket.channel_id, closedById, messages.length, summaryText, closeReason);
```

Und nach dem `enrichTicketClose`-Block, direkt danach, Transkript + archived_at:

```ts
  // ── 5b. Generate HTML transcript (non-critical) ─────────────────────────
  if (ticket) {
    try {
      const transcriptMessages: TranscriptMessage[] = messages.map(m => ({
        authorId:        m.authorId,
        authorTag:       m.authorName,
        authorIsBot:     m.isBot,
        authorIsSupport: !m.isBot && m.authorId !== ticket.opener_user_id,
        content:         m.content,
        attachments:     [],
        timestamp:       m.timestamp,
      }));

      const guildName = guild.name;
      const dataDir   = join(process.cwd(), 'data');
      const relPath   = await generateTranscript(ticket, transcriptMessages, guildName, dataDir);
      setTranscriptPath(ticket.channel_id, relPath);
      logger.info(`[archiveTicket] Transkript gespeichert: ${relPath}`);
    } catch (err) {
      logger.warn('[archiveTicket] Transkript-Generierung fehlgeschlagen (non-critical):', err);
    }

    try {
      setArchivedAt(ticket.channel_id, Math.floor(Date.now() / 1000));
    } catch (err) {
      logger.warn('[archiveTicket] setArchivedAt fehlgeschlagen:', err);
    }
  }
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | head -30
```

Expected: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/services/ticketArchiveService.ts
git commit -m "feat(tickets): integrate HTML transcript and archived_at into archive flow"
```

---

### Task 9: Close-Reason Modal

**Files:**
- Modify: `src/interactions/buttons/confirmClose.ts`
- Create: `src/interactions/modals/ticketCloseReasonModal.ts`

- [ ] **Step 1: Modify confirmClose.ts to show modal**

`src/interactions/buttons/confirmClose.ts` vollständig ersetzen:

```ts
import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  type ButtonInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketConfirmCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CONFIRM_CLOSE,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_CLOSE_REASON_MODAL, channelId))
      .setTitle('Ticket schließen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Schließgrund')
            .setPlaceholder('Warum wird dieses Ticket geschlossen?')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
```

- [ ] **Step 2: Create ticketCloseReasonModal.ts**

Erstelle `src/interactions/modals/ticketCloseReasonModal.ts`:

```ts
import type { ModalSubmitInteraction } from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { closeTicket } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS } from '../../utils/ids';
import type { ModalHandler } from '../../types';

export const ticketCloseReasonModalHandler: ModalHandler = {
  prefix: IDS.TICKET_CLOSE_REASON_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const reason = interaction.fields.getTextInputValue('close_reason');
    await interaction.deferReply({ ephemeral: true });

    try {
      await closeTicket(interaction.guild, channelId, interaction.member, reason);
      await interaction.editReply({ content: '✅ Ticket wurde geschlossen.' }).catch(() => void 0);
    } catch (err) {
      await interaction.editReply({ content: `❌ Fehler: ${err instanceof Error ? err.message : String(err)}` }).catch(() => void 0);
    }
  },
};
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/interactions/buttons/confirmClose.ts src/interactions/modals/ticketCloseReasonModal.ts
git commit -m "feat(tickets): replace direct close with close-reason modal"
```

---

### Task 10: Priorität-Select-Menu

**Files:**
- Create: `src/interactions/selectMenus/ticketPrioritySelect.ts`

- [ ] **Step 1: Create ticketPrioritySelect.ts**

Erstelle `src/interactions/selectMenus/ticketPrioritySelect.ts`:

```ts
import {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  type ButtonInteraction, type StringSelectMenuInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { setPriority } from '../../services/ticketService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
import type { ButtonHandler, SelectMenuHandler } from '../../types';

export const ticketPriorityPromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_PRIORITY_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Nur Support-Mitglieder können die Priorität setzen.');
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(makeId(IDS.TICKET_PRIORITY, channelId))
      .setPlaceholder('Priorität auswählen...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🟢 Niedrig').setValue('low').setDescription('Kein zeitlicher Druck'),
        new StringSelectMenuOptionBuilder().setLabel('🟡 Mittel').setValue('medium').setDescription('Standard-Priorität'),
        new StringSelectMenuOptionBuilder().setLabel('🔴 Hoch').setValue('high').setDescription('Zeitkritisch'),
        new StringSelectMenuOptionBuilder().setLabel('🚨 Dringend').setValue('urgent').setDescription('Sofortiger Handlungsbedarf'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: '🔺 Wähle eine Priorität:', components: [row], ephemeral: true });
  },
};

export const ticketPrioritySelectHandler: SelectMenuHandler = {
  prefix: IDS.TICKET_PRIORITY,

  async execute(interaction: StringSelectMenuInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const priority = interaction.values[0];
    if (!priority) return replyError(interaction, 'Keine Priorität ausgewählt.');

    await setPriority(interaction.guild, channelId, priority);
    await interaction.update({ content: `✅ Priorität auf **${priority}** gesetzt.`, components: [] });
  },
};
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/interactions/selectMenus/ticketPrioritySelect.ts
git commit -m "feat(tickets): add priority prompt button + priority select menu handler"
```

---

### Task 11: Notiz-Modal

**Files:**
- Create: `src/interactions/modals/ticketNoteModal.ts`

- [ ] **Step 1: Create ticketNoteModal.ts**

Erstelle `src/interactions/modals/ticketNoteModal.ts`:

```ts
import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  type ButtonInteraction, type ModalSubmitInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { addNote } from '../../services/ticketNotesService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
import type { ButtonHandler, ModalHandler } from '../../types';

export const ticketNotePromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_NOTE_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Notizen hinzufügen.');
    }

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_NOTE_MODAL, channelId))
      .setTitle('Interne Notiz hinzufügen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('note_content')
            .setLabel('Notiz (intern — nur für Support sichtbar)')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};

export const ticketNoteModalHandler: ModalHandler = {
  prefix: IDS.TICKET_NOTE_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const content = interaction.fields.getTextInputValue('note_content');

    try {
      await addNote(
        ticket.id,
        interaction.guildId,
        interaction.member.id,
        interaction.member.user.tag,
        content,
      );
      await interaction.reply({
        content: '✅ Notiz wurde intern gespeichert.',
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: `❌ Fehler beim Speichern der Notiz: ${err instanceof Error ? err.message : String(err)}`,
        ephemeral: true,
      });
    }
  },
};
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/interactions/modals/ticketNoteModal.ts
git commit -m "feat(tickets): add note prompt button + note modal handler"
```

---

### Task 12: registerInteractions.ts + ticketAutoClose close_reason

**Files:**
- Modify: `src/bootstrap/registerInteractions.ts`
- Modify: `src/features/ticketAutoClose.ts`

- [ ] **Step 1: Read current registerInteractions.ts**

```bash
cat src/bootstrap/registerInteractions.ts
```

- [ ] **Step 2: Add new handler imports and registrations**

In `src/bootstrap/registerInteractions.ts` folgende Imports hinzufügen:

```ts
import { ticketCloseReasonModalHandler } from '../interactions/modals/ticketCloseReasonModal';
import { ticketPriorityPromptHandler, ticketPrioritySelectHandler } from '../interactions/selectMenus/ticketPrioritySelect';
import { ticketNotePromptHandler, ticketNoteModalHandler } from '../interactions/modals/ticketNoteModal';
```

Und in der `registerInteractions(ctx)` Funktion die neuen Handler registrieren:

```ts
  // Neue Priority + Note + CloseReason Handler
  ctx.buttonHandlers.set(IDS.TICKET_PRIORITY_PROMPT, ticketPriorityPromptHandler);
  ctx.buttonHandlers.set(IDS.TICKET_NOTE_PROMPT,     ticketNotePromptHandler);
  ctx.selectMenuHandlers.set(IDS.TICKET_PRIORITY,    ticketPrioritySelectHandler);
  ctx.modalHandlers.set(IDS.TICKET_CLOSE_REASON_MODAL, ticketCloseReasonModalHandler);
  ctx.modalHandlers.set(IDS.TICKET_NOTE_MODAL,         ticketNoteModalHandler);
```

Achtung: `IDS` muss importiert sein. Falls noch nicht: `import { IDS } from '../utils/ids';` hinzufügen.

- [ ] **Step 3: Update ticketAutoClose.ts to set close_reason**

In `src/features/ticketAutoClose.ts`, direkt nach dem `archiveTicket`-Aufruf und vor `closeTicket(channelId)`:

```ts
    // Schließgrund für Auto-Close setzen
    try {
      const { setTicketCloseReason } = await import('../db/index');
      setTicketCloseReason(channelId, 'Auto-close: Keine Aktivität (24 Stunden)');
    } catch { /* non-critical */ }
```

Oder besser, Import am Anfang der Datei hinzufügen:
```ts
import {
  findTicketByChannel, closeTicket,
  getAllOpenTickets, touchTicketActivity,
  setTicketCloseReason,
} from '../db/index';
```

Und dann im `fireAutoClose`-Body, nach `archiveTicket`:
```ts
    setTicketCloseReason(channelId, 'Auto-close: Keine Aktivität (24 Stunden)');
    closeTicket(channelId);
```

- [ ] **Step 4: Run build + all tests**

```bash
npm run build 2>&1 | head -30 && npx vitest run
```

Expected: build clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap/registerInteractions.ts src/features/ticketAutoClose.ts
git commit -m "feat(tickets): register new interaction handlers, set close_reason in auto-close"
```

---

### Task 13: Dashboard API — Erweiterte Filter + Transcript + Notes

**Files:**
- Modify: `src/dashboard/routes/api/tickets.routes.ts`

- [ ] **Step 1: Rewrite tickets.routes.ts**

`src/dashboard/routes/api/tickets.routes.ts` vollständig ersetzen:

```ts
import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  getFilteredTickets, countFilteredTickets, getClosedTicketById,
  getTicketNotes, createTicketNote, deleteTicketNote,
  type TicketFilters,
} from '../../../db/index';
import { requirePermission, PermLevel } from '../../auth/middleware';
import { parsePageQuery, parsePositiveIntParam } from '../shared/request-validators';

export const ticketsRouter = Router();

ticketsRouter.use(requirePermission(PermLevel.Moderator));

// ─── GET /api/tickets ─────────────────────────────────────────────────────────
ticketsRouter.get('/', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const page    = parsePageQuery(req.query.page, 1, 10_000);
    const limit   = 25;
    const offset  = (page - 1) * limit;

    const filters: TicketFilters = {};
    if (typeof req.query.status   === 'string' && req.query.status)   filters.status    = req.query.status;
    if (typeof req.query.priority === 'string' && req.query.priority) filters.priority  = req.query.priority;
    if (typeof req.query.category === 'string' && req.query.category) filters.category  = req.query.category;
    if (typeof req.query.claimed_by === 'string' && req.query.claimed_by) filters.claimedBy = req.query.claimed_by;
    if (typeof req.query.creator  === 'string' && req.query.creator)  filters.creator   = req.query.creator;
    if (typeof req.query.tags     === 'string' && req.query.tags)     filters.tags      = req.query.tags;
    if (typeof req.query.search   === 'string' && req.query.search)   filters.search    = req.query.search.slice(0, 120);
    if (typeof req.query.date_from === 'string' && req.query.date_from) {
      const ts = Math.floor(new Date(req.query.date_from).getTime() / 1000);
      if (!isNaN(ts)) filters.dateFrom = ts;
    }
    if (typeof req.query.date_to === 'string' && req.query.date_to) {
      const ts = Math.floor(new Date(req.query.date_to + 'T23:59:59Z').getTime() / 1000);
      if (!isNaN(ts)) filters.dateTo = ts;
    }

    const total   = countFilteredTickets(guildId, filters);
    const tickets = getFilteredTickets(guildId, filters, limit, offset).map(t => ({
      ...t,
      has_transcript: !!t.transcript_path,
    }));

    res.json({ success: true, data: { tickets, total, page, pages: Math.ceil(total / limit) } });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── GET /api/tickets/:id ────────────────────────────────────────────────────
ticketsRouter.get('/:id', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const notes = getTicketNotes(ticket.id, guildId).map(n => ({
      id:        n.id,
      authorId:  n.author_id,
      authorTag: n.author_tag,
      content:   n.content,
      createdAt: n.created_at,
    }));

    res.json({
      success: true,
      data: { ...ticket, notes, has_transcript: !!ticket.transcript_path },
    });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── GET /api/tickets/:id/transcript ─────────────────────────────────────────
ticketsRouter.get('/:id/transcript', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket || !ticket.transcript_path) {
      res.status(404).json({ success: false, error: 'Transcript not found' });
      return;
    }

    const absPath = join(process.cwd(), 'data', ticket.transcript_path);
    if (!existsSync(absPath)) {
      res.status(404).json({ success: false, error: 'Transcript file missing' });
      return;
    }

    const html = readFileSync(absPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── POST /api/tickets/:id/notes ─────────────────────────────────────────────
const noteBodySchema = z.object({
  content: z.string().min(1).max(1000),
});

ticketsRouter.post('/:id/notes', (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const userId  = req.session.user!.userId;
    const userTag = req.session.user!.username;
    const id      = parsePositiveIntParam(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const ticket = getClosedTicketById(id, guildId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const parsed = noteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      return;
    }

    const note = createTicketNote({
      ticket_id:  ticket.id,
      guild_id:   guildId,
      author_id:  userId,
      author_tag: userTag,
      content:    parsed.data.content,
      created_at: Math.floor(Date.now() / 1000),
    });

    res.status(201).json({ success: true, data: note });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});

// ─── DELETE /api/tickets/:id/notes/:noteId ───────────────────────────────────
ticketsRouter.delete('/:id/notes/:noteId', requirePermission(PermLevel.Admin), (req, res) => {
  try {
    const guildId = req.session.user!.guildId;
    const noteId  = parsePositiveIntParam(req.params.noteId);
    if (!noteId) { res.status(400).json({ success: false, error: 'Invalid note ID' }); return; }

    deleteTicketNote(noteId, guildId);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: 'Internal error' }); }
});
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/routes/api/tickets.routes.ts
git commit -m "feat(tickets): extend dashboard API with filters, transcript endpoint, notes CRUD"
```

---

### Task 14: Dashboard API Tests (TDD)

**Files:**
- Create: `src/dashboard/__tests__/ticketsApi.test.ts`

- [ ] **Step 1: Write ticket API tests**

Erstelle `src/dashboard/__tests__/ticketsApi.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { initDb, createTicket, getDb } from '../../db/index';
import { ticketsRouter } from '../routes/api/tickets.routes';
import { PermLevel } from '../auth/middleware';
import type { DashboardUser } from '../auth/middleware';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const MOD_USER: DashboardUser = {
  userId: 'mod1', username: 'Mod#0001', avatar: null,
  permLevel: PermLevel.Moderator, isContentEditor: false, guildId: 'g1',
};
const ADMIN_USER: DashboardUser = {
  userId: 'adm1', username: 'Admin#0001', avatar: null,
  permLevel: PermLevel.Admin, isContentEditor: false, guildId: 'g1',
};

function makeApp(user: DashboardUser | null = MOD_USER) {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test', resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false },
  }));
  if (user) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.session.user = user;
      next();
    });
  }
  app.use('/api/tickets', ticketsRouter);
  return app;
}

const TMP = join(process.cwd(), 'tmp-tickets-api-test-' + Date.now());

beforeEach(() => {
  initDb(':memory:');
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('GET /api/tickets', () => {
  it('returns 401 without session', async () => {
    const res = await request(makeApp(null)).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('returns ticket list with default filters', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tickets).toHaveLength(1);
  });

  it('filters by priority', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET priority = 'high' WHERE channel_id = 'c1'`).run();
    createTicket({ guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1', category: 'ban', created_at: 1000 });

    const res = await request(makeApp()).get('/api/tickets?priority=high');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].priority).toBe('high');
  });

  it('filters by category', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban',       created_at: 1000 });
    createTicket({ guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1', category: 'whitelist', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets?category=ban');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].category).toBe('ban');
  });

  it('includes has_transcript flag', async () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    const res = await request(makeApp()).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets[0]).toHaveProperty('has_transcript');
  });
});

describe('GET /api/tickets/:id', () => {
  it('returns ticket with notes array', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(t.id);

    const res = await request(makeApp()).get(`/api/tickets/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toEqual([]);
    expect(res.body.data).toHaveProperty('has_transcript');
  });

  it('returns 404 for unknown ticket', async () => {
    const res = await request(makeApp()).get('/api/tickets/99999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/tickets/:id/transcript', () => {
  it('returns 404 when transcript_path is null', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(t.id);
    const res = await request(makeApp()).get(`/api/tickets/${t.id}/transcript`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tickets/:id/notes', () => {
  it('creates a note and returns 201', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(t.id);

    const res = await request(makeApp())
      .post(`/api/tickets/${t.id}/notes`)
      .send({ content: 'Testnotiz vom Dashboard' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Testnotiz vom Dashboard');
  });

  it('rejects empty content', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(t.id);
    const res = await request(makeApp())
      .post(`/api/tickets/${t.id}/notes`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tickets/:id/notes/:noteId', () => {
  it('requires Admin permission', async () => {
    const res = await request(makeApp(MOD_USER))
      .delete('/api/tickets/1/notes/1');
    expect(res.status).toBe(403);
  });

  it('deletes note as Admin', async () => {
    const t = createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'ban', created_at: 1000 });
    getDb().prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(t.id);
    const noteResult = getDb()
      .prepare(`INSERT INTO ticket_notes (ticket_id, guild_id, author_id, author_tag, content, created_at) VALUES (?, 'g1', 'a1', 'A#0001', 'Notiz', 1000)`)
      .run(t.id);
    const noteId = noteResult.lastInsertRowid;

    const res = await request(makeApp(ADMIN_USER))
      .delete(`/api/tickets/${t.id}/notes/${noteId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/dashboard/__tests__/ticketsApi.test.ts
```

Expected: alle Tests bestehen.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/__tests__/ticketsApi.test.ts
git commit -m "test(tickets): add dashboard API tests for filters, transcript, notes endpoints"
```

---

### Task 15: Dashboard Frontend — tickets.js + api.js

**Files:**
- Modify: `dashboard/public/js/pages/tickets.js`
- Modify: `dashboard/public/js/api.js`

- [ ] **Step 1: Add ticket API methods to api.js**

In `dashboard/public/js/api.js`, nach den bestehenden `ticket:` und `tickets:` Zeilen folgende Methoden ergänzen:

```js
  ticketTranscriptUrl: (id) => `/api/tickets/${id}/transcript`,
  ticketNotes: {
    add:    (id, body)    => API.post(`/tickets/${id}/notes`, body),
    delete: (id, noteId) => API.delete(`/tickets/${id}/notes/${noteId}`),
  },
```

- [ ] **Step 2: Rewrite tickets.js with filters, priority badge, notes + transcript**

`dashboard/public/js/pages/tickets.js` vollständig ersetzen:

```js
// dashboard/public/js/pages/tickets.js
window['page-tickets'] = {
  state: { status: 'all', page: 1, search: '', priority: '', category: '' },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket-Verwaltung</h1><p>Alle Tickets durchsuchen, filtern und Details anzeigen.</p></div>
      <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
        <div class="period-bar">
          ${['open','closed','all'].map(s => `<button class="period-btn${s===self.state.status?' active':''}" data-status="${s}">${s==='open'?'Offen':s==='closed'?'Geschlossen':'Alle'}</button>`).join('')}
        </div>
        <select class="form-input" style="max-width:140px" id="filter-priority">
          <option value="">Alle Prioritäten</option>
          <option value="low">🟢 Niedrig</option>
          <option value="medium">🟡 Mittel</option>
          <option value="high">🔴 Hoch</option>
          <option value="urgent">🚨 Dringend</option>
        </select>
        <input class="form-input" style="max-width:160px" placeholder="Kategorie..." id="filter-category" value="">
        <input class="form-input" style="max-width:240px" placeholder="Suche nach Kategorie, User..." id="ticket-search" value="${escapeHtml(self.state.search)}">
      </div>
      <div class="table-card" id="ticket-table-wrap"><div class="skeleton tall"></div></div>
      <div id="ticket-pagination" class="pagination"></div>
    `;

    container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.state.status = btn.dataset.status;
        self.state.page = 1;
        container.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === self.state.status));
        self.load();
      });
    });

    document.getElementById('filter-priority').value = self.state.priority;
    document.getElementById('filter-priority').addEventListener('change', (e) => {
      self.state.priority = e.target.value;
      self.state.page = 1;
      self.load();
    });

    let catTimeout;
    document.getElementById('filter-category').addEventListener('input', (e) => {
      clearTimeout(catTimeout);
      catTimeout = setTimeout(() => { self.state.category = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    let searchTimeout;
    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { self.state.search = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    await self.load();
  },

  priorityBadge(priority) {
    const map = { low: ['🟢', 'Niedrig', 'badge-success'], medium: ['🟡', 'Mittel', 'badge-neutral'], high: ['🔴', 'Hoch', 'badge-warning'], urgent: ['🚨', 'Dringend', 'badge-error'] };
    const [emoji, label, cls] = map[priority] ?? ['🟡', priority, 'badge-neutral'];
    return `<span class="badge ${cls}">${emoji} ${label}</span>`;
  },

  async load() {
    const wrap = document.getElementById('ticket-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton tall"></div>';
    try {
      const q = { status: this.state.status, page: this.state.page, search: this.state.search };
      if (this.state.priority) q.priority = this.state.priority;
      if (this.state.category) q.category = this.state.category;
      const { data } = await API.tickets(q);
      const { tickets, total, pages } = data;

      if (tickets.length === 0) { wrap.innerHTML = emptyState('Keine Tickets gefunden.'); return; }

      wrap.innerHTML = `
        <div class="table-wrap"><table class="responsive-table">
          <thead><tr><th>#</th><th>Kategorie</th><th>Priorität</th><th>Status</th><th>Erstellt</th><th>Geschlossen</th><th>Bearbeiter</th></tr></thead>
          <tbody>${tickets.map(t => `
            <tr class="clickable-row" onclick="window['page-tickets'].showDetail(${t.id})">
              <td data-label="#" class="mono dim">${t.id}</td>
              <td data-label="Kategorie">${escapeHtml(t.category)}</td>
              <td data-label="Priorität">${this.priorityBadge(t.priority ?? 'medium')}</td>
              <td data-label="Status"><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td>
              <td data-label="Erstellt" class="dim">${fmtDate(t.created_at)}</td>
              <td data-label="Geschlossen" class="dim">${t.closed_at ? fmtDate(t.closed_at) : '—'}</td>
              <td data-label="Bearbeiter" class="dim">${escapeHtml(t.closed_by_username_snapshot ?? '—')}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>
        <div class="page-info">${total} Tickets gesamt</div>
      `;

      const pgEl = document.getElementById('ticket-pagination');
      pgEl.innerHTML = '';
      if (pages > 1) {
        for (let i = 1; i <= Math.min(pages, 10); i++) {
          const btn = document.createElement('button');
          btn.className = `page-btn${i === this.state.page ? ' active' : ''}`;
          btn.textContent = i;
          btn.addEventListener('click', () => { this.state.page = i; this.load(); });
          pgEl.appendChild(btn);
        }
      }
    } catch (err) {
      wrap.innerHTML = `${errorState(err.message)}<div class="cta-row" style="justify-content:center;padding:0 1rem 1rem"><button class="btn btn-ghost" id="tickets-retry">Erneut laden</button></div>`;
      document.getElementById('tickets-retry')?.addEventListener('click', () => this.load());
    }
  },

  showDetail(id) {
    const existing = document.getElementById('ticket-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'ticket-modal';
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><div class="modal-title">Ticket #${id}</div><button class="modal-close" id="modal-close-btn">✕</button></div><div id="modal-body"><div class="skeleton" style="height:200px"></div></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());

    API.ticket(id).then(({ data: t }) => {
      const notesHtml = (t.notes ?? []).length === 0
        ? '<p style="color:var(--text-muted);font-size:.82rem">Keine internen Notizen.</p>'
        : (t.notes ?? []).map(n => `
            <div style="background:var(--surface-raised);border-radius:6px;padding:10px;margin-bottom:6px">
              <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">${escapeHtml(n.authorTag)} · ${fmtDate(n.createdAt)}</div>
              <div style="font-size:.85rem">${escapeHtml(n.content)}</div>
            </div>`).join('');

      document.getElementById('modal-body').innerHTML = `
        <div class="modal-field"><div class="modal-field-label">Kategorie</div><div class="modal-field-value">${escapeHtml(t.category)}</div></div>
        <div class="modal-field"><div class="modal-field-label">Priorität</div><div class="modal-field-value">${this.priorityBadge(t.priority ?? 'medium')}</div></div>
        <div class="modal-field"><div class="modal-field-label">Status</div><div class="modal-field-value"><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></div></div>
        ${t.close_reason ? `<div class="modal-field"><div class="modal-field-label">Schließgrund</div><div class="modal-field-value">${escapeHtml(t.close_reason)}</div></div>` : ''}
        <div class="modal-field"><div class="modal-field-label">Erstellt</div><div class="modal-field-value">${fmtDate(t.created_at)}</div></div>
        <div class="modal-field"><div class="modal-field-label">Geschlossen</div><div class="modal-field-value">${t.closed_at ? fmtDate(t.closed_at) : '—'}</div></div>
        <div class="modal-field"><div class="modal-field-label">Nachrichten</div><div class="modal-field-value">${t.message_count ?? '—'}</div></div>
        <div class="modal-field"><div class="modal-field-label">Bearbeiter</div><div class="modal-field-value">${escapeHtml(t.closed_by_username_snapshot ?? '—')}</div></div>
        ${t.summary ? `<div class="modal-field"><div class="modal-field-label">Zusammenfassung</div><div class="modal-field-value" style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${escapeHtml(t.summary)}</div></div>` : ''}
        ${t.has_transcript ? `<div class="modal-field"><button class="btn btn-ghost" onclick="window.open('${API.ticketTranscriptUrl(t.id)}', '_blank')">📄 Transcript öffnen</button></div>` : ''}
        <div class="modal-field" style="margin-top:12px"><div class="modal-field-label">Interne Notizen</div><div>${notesHtml}</div></div>
      `;
    }).catch(err => { toast('Ticket konnte nicht geladen werden: ' + err.message, 'error'); overlay.remove(); });
  },
};
```

- [ ] **Step 3: Run build (TypeScript compile)**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: alle Tests bestehen.

- [ ] **Step 5: Commit**

```bash
git add dashboard/public/js/pages/tickets.js dashboard/public/js/api.js
git commit -m "feat(tickets): update dashboard frontend with priority filter, badges, notes, transcript button"
```

---

### Task 16: docs/TICKETS.md

**Files:**
- Create: `docs/TICKETS.md`

- [ ] **Step 1: Create TICKETS.md**

Erstelle `docs/TICKETS.md`:

```markdown
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
```

- [ ] **Step 2: Run all tests one final time**

```bash
npx vitest run
```

Expected: alle Tests bestehen.

- [ ] **Step 3: Commit**

```bash
git add docs/TICKETS.md
git commit -m "docs(tickets): add TICKETS.md with lifecycle, data model, priorities, transcripts, notes"
```

---

## Abschluss-Check

Nach allen Tasks:

```bash
npm run build && npx vitest run
```

Erwartetes Ergebnis:
- `npm run build`: keine TypeScript-Fehler
- `npx vitest run`: alle Tests bestehen (inkl. bestehende `security.test.ts`, `registerCommands.test.ts`, `registerInteractions.test.ts`)

Neue Testdateien und ihre Abdeckung:
- `src/db/__tests__/ticketMigration.test.ts` — 5 Tests: Migrations-Idempotenz, neue Spalten, ticket_notes-Tabelle
- `src/services/__tests__/ticketTranscriptService.test.ts` — 7 Tests: HTML-Generierung, Metadaten, Anhänge, keine externen Deps, Max-500
- `src/services/__tests__/ticketNotesService.test.ts` — 7 Tests: CRUD, Guild-Isolation
- `src/dashboard/__tests__/ticketsApi.test.ts` — 10 Tests: Filter, Transcript 404, Notes POST/DELETE, Auth-Checks
