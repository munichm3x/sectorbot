# AI System — sectorbot

sectorbot uses a modular AI architecture in `src/ai/`. All AI calls go through a unified provider interface with automatic fallback, quality validation, and crash-safe error handling.

---

## Module Structure

```
src/ai/
  providers/          ← One class per AI service
    geminiProvider.ts
    groqProvider.ts
    openRouterProvider.ts
    ollamaProvider.ts
  tasks/              ← One function per bot feature that uses AI
    ticketSummaryTask.ts
    oldManLoreTask.ts
  prompts/            ← Prompt builders (pure functions → ChatMessage[])
    ticketSummaryPrompt.ts
    oldManLorePrompt.ts
  validation/         ← Output validators and quality checks
    validateAiReply.ts
    validateTicketSummary.ts
  aiClient.ts         ← Central router: primary → fallback → error result
  contextBuilder.ts   ← Builds Discord context (history, knowledge, reply-to)
  types.ts            ← Shared types: AIProvider, ChatMessage, AskResult, TicketSummaryJSON
```

---

## Providers

| Name | Required ENV key | Default model | Timeout | Use case |
|------|-----------------|---------------|---------|----------|
| `gemini` | `GEMINI_API_KEY` | `gemini-1.5-flash-8b` | 20s | Primary for Old Man Lore |
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | 15s | Ticket summaries, fallback |
| `openrouter` | `OPENROUTER_API_KEY` | `meta-llama/llama-3-8b-instruct:free` | 20s | Optional fallback |
| `ollama` | *(none — local)* | `sector13-oldman` | 60s | Local fallback for Old Man Lore |

All providers implement the `AIProvider` interface:

```typescript
interface AIProvider {
  readonly name:  string;
  readonly model: string;
  ask(messages: ChatMessage[]): Promise<string>;
}
```

---

## ENV Reference

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Primary provider for all tasks unless overridden |
| `AI_FALLBACK_PROVIDER` | `groq` | Used when primary fails |
| `AI_MODEL` | `""` | Optional model override for primary provider |
| `GEMINI_API_KEY` | `""` | Required for Gemini provider |
| `GROQ_API_KEY` | `""` | Required for Groq provider |
| `OPENROUTER_API_KEY` | `""` | Required for OpenRouter provider |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server root URL |
| `OLLAMA_MODEL` | `sector13-oldman` | Ollama model name |
| `OLLAMA_TIMEOUT_MS` | `60000` | Ollama request timeout in ms |
| `AI_TICKET_ENABLED` | `true` | Set to `false` to disable AI for ticket summaries |
| `AI_TICKET_PROVIDER` | `""` | Override provider for ticket summaries only |
| `AI_OLDMAN_ENABLED` | `true` | Set to `false` to disable AI for Old Man Lore |
| `AI_OLDMAN_PROVIDER` | `""` | Override provider for Old Man Lore only |
| `ANALYTICS_AI_ENABLED` | `true` | Track AI events in analytics DB |

---

## Ticket Summary JSON

When `AI_TICKET_ENABLED=true` and a provider is configured, ticket archiving produces a structured JSON summary stored in the `summary_json` column.

### Schema

```typescript
interface TicketSummaryJSON {
  short_summary:  string;    // 1-2 sentences describing the ticket
  problem:        string;    // the core problem or "Nicht erkennbar"
  user_request:   string;    // what the user needed or "Nicht erkennbar"
  actions_taken:  string;    // what support staff did or "Nicht erkennbar"
  resolution:     string;    // outcome or "Kein klares Ergebnis erkennbar"
  open_points:    string;    // follow-up items or ""
  priority:       'low' | 'medium' | 'high' | 'urgent';
  tags:           string[];  // up to 8 topic tags
  needs_followup: boolean;
}
```

### Example Output

```json
{
  "short_summary": "Spieler bittet um Whitelist-Aufnahme nach Steam-ID-Verifizierung.",
  "problem": "Konto nicht auf der Whitelist.",
  "user_request": "Freischaltung für den Server.",
  "actions_taken": "Admin hat Steam-ID über Profil bestätigt.",
  "resolution": "Spieler wurde erfolgreich freigeschaltet.",
  "open_points": "",
  "priority": "low",
  "tags": ["whitelist", "steam-id"],
  "needs_followup": false
}
```

### Fallback

If the AI fails, returns `null`, or produces invalid JSON after 2 attempts, the system falls back to the keyword-based text summary. The `summary_json` column remains `NULL`; the `summary` text column always has a value.

---

## Fallback Chain

```
Task call (e.g. runTicketSummaryTask)
  ↓
AI_TICKET_PROVIDER set?
  → yes: build provider directly
  → no:  use global AI_PROVIDER singleton (aiClient.ts)
          ↓
          primary provider → try
          ↓ (on error)
          fallback provider → try
          ↓ (on error)
          AskResult { text: '', error: 'all_providers_failed' }
  ↓
validateTicketSummary(result.text)
  → valid JSON → return TicketSummaryJSON
  → null       → retry once with stricter prompt
  → still null → log warning, return null
  ↓
generateTicketSummary: null → fallbackSummary() (keyword-based text)
```

---

## Quality Gate (`validateAiReply`)

Applied to every AI response before it is used by Old Man Lore. **Not** applied to ticket summaries (JSON validation is used instead).

| Check | Action on fail |
|-------|---------------|
| Too short (< 3 chars) | `pass: false` — response discarded |
| Meta-commentary ("Certainly!", "As an AI…") | `pass: false` — response discarded |
| Hallucination markers (`[source]`, "laut Wikipedia") | `pass: false` — response discarded |
| Structural markdown noise (`##`, numbered list) | Strip prefix, retry length check |
| Repeats question verbatim (≥ 60% overlap) | Note in `reasons`, but `pass: true` |
| Too long (> 600 chars) | Trim to last sentence ≤ 600 chars, `pass: true` |

A `pass: false` result causes `AskResult.text` to be `""`. The calling code treats empty text as a failure and uses the fallback pool.

---

## Per-Task Configuration

Use task-specific provider overrides when you want different AI models per feature:

```env
# Use Groq for ticket summaries (fast, structured output)
AI_TICKET_PROVIDER=groq

# Use Gemini for Old Man Lore (better creative writing)
AI_OLDMAN_PROVIDER=gemini

# Disable ticket AI entirely (use keyword fallback)
AI_TICKET_ENABLED=false
```

When a task-specific provider is set, `buildProvider(name, true)` is called directly — the global `aiClient.ts` singleton is bypassed for that task only.

---

## Adding a New Provider

1. Create `src/ai/providers/myProvider.ts` implementing `AIProvider`
2. Add a case to `buildProvider()` in `src/ai/aiClient.ts`
3. Add the API key to `src/config/env.ts`
4. Document the provider in this file

The provider must:
- Accept `ask(messages: ChatMessage[]): Promise<string>` — throw on any failure
- Use `AbortController` for timeout — `timeoutMs` configurable in constructor
- Never log API keys or message content
