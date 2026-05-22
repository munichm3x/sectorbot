# AI Modularization Design Spec

**Date:** 2026-05-23
**Status:** Approved

---

## Overview

Modularize all AI functionality in sectorbot into a clean `src/ai/` top-level module. The existing `src/services/ai/` architecture is already sound — this spec expands it with structured ticket summaries, an Ollama provider, per-task configuration, comprehensive tests, and documentation.

**Key constraints:**
- Existing AI functions must not be removed
- No real API keys committed
- No private message content in logs
- AI failures must never crash the bot
- Ticket closing must work without AI
- TypeScript check and tests must pass

---

## Module Structure

### New layout: `src/ai/`

```
src/ai/
  providers/
    geminiProvider.ts         ← moved from src/services/ai/providers/ (no logic change)
    groqProvider.ts           ← moved (no logic change)
    openRouterProvider.ts     ← moved (no logic change)
    ollamaProvider.ts         ← NEW
  tasks/
    ticketSummaryTask.ts      ← NEW
    oldManLoreTask.ts         ← NEW (thin wrapper)
  prompts/
    ticketSummaryPrompt.ts    ← NEW
    oldManLorePrompt.ts       ← NEW (extracted from oldManLore.ts)
  validation/
    validateTicketSummary.ts  ← NEW
    validateAiReply.ts        ← moved from qualityGate.ts (renamed, no logic change)
  aiClient.ts                 ← moved + renamed from aiService.ts (no logic change)
  contextBuilder.ts           ← moved (no logic change)
  types.ts                    ← moved + extended with TicketSummaryJSON
```

### Files that change import paths

| File | Old import | New import |
|------|-----------|-----------|
| `src/features/oldManLore.ts` | `../services/ai/aiService` | `../ai/aiClient` |
| `src/features/oldManLore.ts` | `../services/ai/contextBuilder` | `../ai/contextBuilder` |
| `src/features/oldManLore.ts` | `../services/ai/types` | `../ai/types` |
| `src/services/ticketSummaryService.ts` | (raw fetch) | `../ai/tasks/ticketSummaryTask` |

No other files import from `src/services/ai/`.

---

## Providers

### Existing providers (moved, no logic change)

All three existing providers implement `AIProvider`:

```typescript
interface AIProvider {
  readonly name:  string;
  readonly model: string;
  ask(messages: ChatMessage[]): Promise<string>;
}
```

- **GeminiProvider** — Google Generative Language REST API; handles role merging, system instruction
- **GroqProvider** — OpenAI-compatible; timeout 15s, temperature 0.82, max_tokens 220
- **OpenRouterProvider** — OpenAI-compatible; timeout 20s, adds `HTTP-Referer`/`X-Title` headers

### New: OllamaProvider

File: `src/ai/providers/ollamaProvider.ts`

```typescript
export class OllamaProvider implements AIProvider {
  readonly name  = 'ollama';
  readonly model: string;

  constructor(opts: {
    baseUrl?:    string;   // Ollama server root, e.g. "http://localhost:11434"
    model?:      string;   // default: env.OLLAMA_MODEL ("sector13-oldman")
    timeoutMs?:  number;   // default: 60_000
  })

  async ask(messages: ChatMessage[]): Promise<string>
  // POST to {baseUrl}/api/chat with { model, messages, stream: false }
  // Parses response.message.content from Ollama chat API format
  // AbortController for timeout
  // Throws on HTTP error, empty response, or abort
}
```

`env.ts` adds `OLLAMA_BASE_URL` (default: `http://localhost:11434`) alongside the existing `OLLAMA_URL` (kept for backward compat, no longer used by the new provider). The provider always calls `{OLLAMA_BASE_URL}/api/chat`.

`aiClient.ts` factory (`buildProvider`) adds a `'ollama'` case using `env.OLLAMA_BASE_URL` and `env.OLLAMA_MODEL`.

Ollama is intended as a local fallback for Old Man Lore when no cloud key is configured. It is **not** recommended for ticket summaries (high latency, variable quality).

---

## Per-Task Configuration

Four new ENV variables in `src/config/env.ts`:

| Variable | Default | Description |
|---|---|---|
| `AI_TICKET_ENABLED` | `true` | When `false`, `ticketSummaryTask` returns `null` immediately; fallback text is used |
| `AI_TICKET_PROVIDER` | `""` | Override provider for ticket summary only (e.g. `groq`). Empty = use `AI_PROVIDER`. |
| `AI_OLDMAN_ENABLED` | `true` | When `false`, `oldManLore.ts` skips AI and uses fallback pools |
| `AI_OLDMAN_PROVIDER` | `""` | Override provider for Old Man Lore only. Empty = use `AI_PROVIDER`. |

**Provider resolution per task:**
```
task-specific provider (AI_TICKET_PROVIDER / AI_OLDMAN_PROVIDER)
  → if empty: global AI_PROVIDER
  → if primary fails: AI_FALLBACK_PROVIDER
  → if both fail: null (task handles fallback)
```

When a task-specific provider is set, the task calls `buildProvider(name, true)` — a function exported from `aiClient.ts` that is currently private. It becomes `export function buildProvider(...)`. This keeps `aiClient.ts` simple while allowing tasks to construct one-off provider instances without disrupting the global singleton.

---

## Structured JSON Ticket Summary

### JSON Schema (`TicketSummaryJSON` in `src/ai/types.ts`)

```typescript
export interface TicketSummaryJSON {
  short_summary:  string;          // 1-2 sentences
  problem:        string;          // core issue
  user_request:   string;          // what the user asked for
  actions_taken:  string;          // what support did
  resolution:     string;          // outcome or "Kein klares Ergebnis"
  open_points:    string;          // follow-up needed or ""
  priority:       'low' | 'medium' | 'high' | 'urgent';
  tags:           string[];        // e.g. ["ban", "whitelist"]
  needs_followup: boolean;
}
```

### Prompt (`src/ai/prompts/ticketSummaryPrompt.ts`)

Builds `ChatMessage[]`:
- **system**: Instructs model to respond with ONLY valid JSON matching the schema above. Includes the schema definition inline. Instructs to never fabricate, use "Nicht erkennbar" for unknown fields. German output.
- **user**: Ticket metadata (ID, category, priority, close_reason) + conversation block (same truncation as existing: 60 messages × 250 chars)

### Task (`src/ai/tasks/ticketSummaryTask.ts`)

```typescript
export async function runTicketSummaryTask(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): Promise<TicketSummaryJSON | null>
```

Flow:
1. If `env.AI_TICKET_ENABLED === false` → return `null`
2. Build provider (task-specific or global)
3. Build `ChatMessage[]` via `ticketSummaryPrompt`
4. Call `askAI()` (or task-specific provider)
5. `validateTicketSummary(result.text)` → `TicketSummaryJSON | null`
6. If null (bad JSON): retry once with appended `[RULE: Respond ONLY with valid JSON matching the schema. No preamble.]`
7. If retry also null: log warning, return `null`
8. Return validated JSON

Max 2 provider calls per summary. Never throws.

### Validation (`src/ai/validation/validateTicketSummary.ts`)

```typescript
export function validateTicketSummary(raw: string): TicketSummaryJSON | null
```

Steps:
1. Strip markdown fences (` ```json ... ``` `) if present
2. `JSON.parse()` — if throws, return `null`
3. Check required string fields: `short_summary`, `problem`, `user_request`, `actions_taken`, `resolution`, `open_points` — if missing, fill with `"Nicht erkennbar"`
4. Coerce `priority`: normalize to lowercase, map unknown values → `'medium'`
5. Coerce `tags`: if not array → `[]`; filter to string items; max 8 items
6. Coerce `needs_followup`: boolean coercion
7. Return validated object

### DB Migration

In `src/db/index.ts` (existing migration block):
```typescript
try { db.exec(`ALTER TABLE tickets ADD COLUMN summary_json TEXT`); } catch { /* already exists */ }
```

In `src/types/index.ts` — add to `Ticket` interface:
```typescript
summary_json?: string;
```

### Storage in `ticketSummaryService.ts`

Updated `generateTicketSummary()`:
1. Call `runTicketSummaryTask(ticket, messages, categoryLabel)`
2. If JSON returned:
   - Set `summaryJson = JSON.stringify(json)`
   - Render `summaryText` from JSON in German structured format:
     ```
     Kurzbeschreibung: {short_summary}
     Kernproblem: {problem}
     Nutzeranfrage: {user_request}
     Maßnahmen: {actions_taken}
     Ergebnis: {resolution}
     Offene Punkte: {open_points}
     ```
     (omit "Offene Punkte" line if `open_points` is empty/`""`; append `Priorität: {priority}` if not `'medium'`)
   - Return `{ text: summaryText, usedAI: true, summaryJson }`
3. If null (AI disabled or failed):
   - Return `{ text: fallbackSummary(...), usedAI: false, summaryJson: null }`

`SummaryResult` interface gains optional `summaryJson?: string | null`.

`ticketArchiveService.ts` passes `summaryJson` to `enrichTicketClose()`.

`enrichTicketClose()` in `src/db/index.ts` gains an optional `summaryJson` param:
```sql
UPDATE tickets SET closed_by=?, message_count=?, summary=?,
  close_reason=COALESCE(?,close_reason), summary_json=?
WHERE channel_id=?
```

### Archive Embed Update

`buildArchiveCard()` in `ticketArchiveService.ts`:
- If `ticket.summary_json` is present and parseable: show `short_summary` in the summary field + `needs_followup` indicator in footer
- Otherwise: show existing text summary (unchanged behavior)

### Dashboard Frontend Update

`dashboard/public/js/pages/tickets.js`:
- In the ticket detail modal: if `summary_json` present, render structured fields (problem, resolution, tags, priority, needs_followup) instead of raw text blob
- Falls back to plain `summary` text if no JSON

---

## Old Man Lore Task

### New `src/ai/prompts/oldManLorePrompt.ts`

Extracts `buildSystemPrompt(intent, botReplies)` and `INTENT_NOTE`/`COMMAND_DIRECTIVES` constants currently in `oldManLore.ts`. The feature file imports from here.

### New `src/ai/tasks/oldManLoreTask.ts`

Thin wrapper that encapsulates the anti-repeat retry logic:

```typescript
export async function runOldManLoreTask(
  messages:    ChatMessage[],
  botReplies:  string[],
  command:     LoreCommand,
): Promise<{ reply: string | null; usedFallback: boolean }>
```

- Calls `askAI()` (respects `AI_OLDMAN_PROVIDER` if set)
- On success: checks `isTooSimilar(result.text, botReplies)` → if similar, one retry
- Returns `{ reply: text, usedFallback: false }` or `{ reply: null, usedFallback: false }` on NO_REPLY/failure
- `oldManLore.ts` feature calls this task and handles the fallback pool separately (unchanged contract)

---

## Quality Gate (Renamed)

`qualityGate.ts` moves to `src/ai/validation/validateAiReply.ts`. The function `runQualityGate()` is renamed to `validateAiReply()`. The internal logic is unchanged. `aiClient.ts` imports from the new path.

---

## Logging

No changes needed. `aiClient.ts` already:
- Logs provider, model, char length, duration, fallback flag
- Does not log message content
- Does not log API keys

Ticket summary task adds one log line on JSON validation failure: `[ticketSummaryTask] JSON validation failed (attempt N)` — no ticket content included.

---

## Tests

### `src/ai/__tests__/validateTicketSummary.test.ts`

- Valid JSON with all fields → returns `TicketSummaryJSON`
- Valid JSON with missing `open_points` → fills `"Nicht erkennbar"`
- Priority `"HIGH"` → coerced to `"high"`
- Priority `"critical"` → coerced to `"medium"`
- `tags` as string → coerced to `[]`
- `needs_followup` as `"true"` string → coerced to `true`
- Markdown-fenced JSON (` ```json ... ``` `) → strips fences, parses successfully
- Completely invalid JSON → returns `null`
- Empty string → returns `null`

### `src/ai/__tests__/validateAiReply.test.ts` (moved + extended)

- Empty text → `pass: false, reasons: ['too_short']`
- "Certainly! Here is..." → `pass: false` (meta-commentary)
- Text with `[source]` → `pass: false` (hallucination marker)
- 700-char text → trimmed to sentence boundary ≤ 600
- Text repeating 70% of question words → `reasons` includes `repeats_question`
- Clean 100-char text → `pass: true, reasons: []`

### `src/ai/__tests__/ollamaProvider.test.ts`

Uses `vi.stubGlobal('fetch', ...)`:
- Successful response → returns text content
- Empty `message.content` → throws `'Ollama returned empty response'`
- HTTP 500 → throws error
- AbortController fires after timeout → fetch rejected with `AbortError`

### `src/ai/__tests__/ticketSummaryTask.test.ts`

Uses mock `AIProvider`:
- `AI_TICKET_ENABLED=false` → returns `null` without calling provider
- Valid JSON response → returns `TicketSummaryJSON`
- First response invalid JSON, second valid → returns JSON (retry path)
- Both responses invalid JSON → returns `null`
- Provider throws → returns `null` (never throws itself)

---

## Documentation: `docs/AI.md`

Sections:
1. **Overview** — module structure diagram, responsibility of each directory
2. **Providers** — table: name, env key required, default model, timeout, use case
3. **ENV Reference** — full table of all AI-related env vars with defaults and descriptions
4. **Ticket Summary JSON** — full schema with field descriptions and example output
5. **Fallback Chain** — diagram showing: primary provider → fallback provider → null → text fallback
6. **Quality Gate** — what each check does, what "fail" means (empty response returned to caller)
7. **Per-Task Configuration** — when and how to use `AI_TICKET_PROVIDER` etc.
8. **Adding a New Provider** — implement `AIProvider`, add to `buildProvider()` factory in `aiClient.ts`

---

## Non-Goals

- No Ollama support for ticket summaries (latency incompatible with ticket close flow)
- No streaming responses
- No conversation history for ticket summary (one-shot prompt)
- No AI metrics dashboard endpoint in this spec (metrics are already tracked via `trackAiEvent()`)
- No changes to Groq ticket summary model (remains `llama-3.3-70b-versatile`)
