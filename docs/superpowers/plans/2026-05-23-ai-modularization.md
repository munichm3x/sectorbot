# AI Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `src/services/ai/` → `src/ai/`, add Ollama provider, structured JSON ticket summaries with `summary_json` DB column, per-task AI provider config, comprehensive tests, and `docs/AI.md`.

**Architecture:** Existing provider abstraction is kept intact — we rename, extend, and add layers (tasks/, prompts/, validation/) on top. `ticketSummaryService.ts` stops duplicating Groq calls and delegates to a proper task. `oldManLore.ts` delegates its anti-repeat retry logic to `oldManLoreTask.ts`.

**Tech Stack:** TypeScript 5.6, vitest 2, better-sqlite3 (synchronous), Discord.js v14, Node fetch API

---

## File Map

### Created
| File | Role |
|------|------|
| `src/ai/types.ts` | Moved + adds `TicketSummaryJSON`, `MessageEntry` |
| `src/ai/aiClient.ts` | Renamed from `aiService.ts`; exports `buildProvider` |
| `src/ai/contextBuilder.ts` | Moved (1 import path fixed) |
| `src/ai/providers/geminiProvider.ts` | Exact copy (no changes) |
| `src/ai/providers/groqProvider.ts` | Exact copy (no changes) |
| `src/ai/providers/openRouterProvider.ts` | Exact copy (no changes) |
| `src/ai/providers/ollamaProvider.ts` | New — Ollama chat API |
| `src/ai/validation/validateAiReply.ts` | Renamed from `qualityGate.ts`; fn renamed |
| `src/ai/validation/validateTicketSummary.ts` | New — JSON schema validator |
| `src/ai/prompts/ticketSummaryPrompt.ts` | New — builds ChatMessage[] for JSON summary |
| `src/ai/prompts/oldManLorePrompt.ts` | New — extracts Daniel system prompt + constants |
| `src/ai/tasks/ticketSummaryTask.ts` | New — JSON ticket summary task with retry |
| `src/ai/tasks/oldManLoreTask.ts` | New — anti-repeat retry wrapper |
| `src/ai/__tests__/validateAiReply.test.ts` | New tests |
| `src/ai/__tests__/ollamaProvider.test.ts` | New tests |
| `src/ai/__tests__/validateTicketSummary.test.ts` | New tests |
| `src/ai/__tests__/ticketSummaryTask.test.ts` | New tests |
| `docs/AI.md` | New documentation |

### Modified
| File | Change |
|------|--------|
| `src/features/oldManLore.ts` | Update 4 import paths; use task; import prompt constants |
| `src/config/env.ts` | Add 5 new vars: `OLLAMA_BASE_URL`, `AI_TICKET_ENABLED`, `AI_TICKET_PROVIDER`, `AI_OLDMAN_ENABLED`, `AI_OLDMAN_PROVIDER` |
| `src/types/index.ts` | Add `summary_json?: string \| null` to `Ticket` |
| `src/db/index.ts` | Add `summary_json` migration; update `enrichTicketClose` |
| `src/services/ticketSummaryService.ts` | Remove duplicated Groq fetch; use `runTicketSummaryTask`; add `summaryJson` to result |
| `src/services/ticketArchiveService.ts` | Pass `summaryJson` to `enrichTicketClose`; update archive embed |
| `dashboard/public/js/pages/tickets.js` | Show structured JSON fields in detail modal |

### Deleted
| Directory |
|-----------|
| `src/services/ai/` (entire directory — replaced by `src/ai/`) |

---

## Task 1: Move `src/services/ai/` → `src/ai/`

**Files:**
- Create: `src/ai/types.ts`, `src/ai/contextBuilder.ts`, `src/ai/validation/validateAiReply.ts`, `src/ai/aiClient.ts`
- Create: `src/ai/providers/geminiProvider.ts`, `groqProvider.ts`, `openRouterProvider.ts` (exact copies)
- Modify: `src/features/oldManLore.ts` (4 import path changes)
- Delete: `src/services/ai/` directory

- [ ] **Step 1: Create directory structure**

```powershell
New-Item -ItemType Directory -Force src/ai/providers
New-Item -ItemType Directory -Force src/ai/tasks
New-Item -ItemType Directory -Force src/ai/prompts
New-Item -ItemType Directory -Force src/ai/validation
New-Item -ItemType Directory -Force src/ai/__tests__
```

- [ ] **Step 2: Copy providers (no changes needed — relative import `'../types'` remains valid)**

```powershell
Copy-Item src/services/ai/providers/geminiProvider.ts src/ai/providers/geminiProvider.ts
Copy-Item src/services/ai/providers/groqProvider.ts src/ai/providers/groqProvider.ts
Copy-Item src/services/ai/providers/openRouterProvider.ts src/ai/providers/openRouterProvider.ts
```

- [ ] **Step 3: Copy `types.ts` (no changes)**

```powershell
Copy-Item src/services/ai/types.ts src/ai/types.ts
```

- [ ] **Step 4: Create `src/ai/contextBuilder.ts`** (one import path change: `../../utils/logger` → `../utils/logger`)

```typescript
// src/ai/contextBuilder.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Message, TextChannel } from 'discord.js';
import type { DiscordContext, ChannelHistoryEntry } from './types';
import { logger } from '../utils/logger';

const KNOWLEDGE_DIR = join(process.cwd(), 'data', 'knowledge');

function loadKnowledge(): string {
  try {
    const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
    if (files.length === 0) return '';
    const sections = files.map(f => {
      try {
        const content = readFileSync(join(KNOWLEDGE_DIR, f), 'utf-8').trim();
        return `### ${f.replace('.md', '')}\n${content}`;
      } catch {
        return null;
      }
    }).filter(Boolean);
    return sections.join('\n\n');
  } catch {
    return '';
  }
}

const CACHED_KNOWLEDGE: string = loadKnowledge();

if (CACHED_KNOWLEDGE) {
  logger.info(`[ContextBuilder] Knowledge loaded: ${CACHED_KNOWLEDGE.length} chars`);
} else {
  logger.info('[ContextBuilder] No knowledge files found in data/knowledge/ — skipping');
}

const MAX_HISTORY_MESSAGES = 15;
const MAX_MSG_LEN          = 350;

export async function buildDiscordContext(message: Message): Promise<DiscordContext> {
  const authorName  = message.member?.displayName ?? message.author.username;
  const authorRoles = (message.member?.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .first(3)
    ?.map(r => r.name)) ?? [];

  const channelName = 'name' in message.channel ? (message.channel as TextChannel).name : 'unknown';

  let replyTo: DiscordContext['replyTo'];
  if (message.reference?.messageId) {
    try {
      const ref = await message.channel.messages.fetch(message.reference.messageId);
      const refAuthor = ref.member?.displayName ?? ref.author.username;
      replyTo = { authorName: refAuthor, content: truncate(ref.content, 400) };
    } catch {
      // Reply may be deleted — ignore silently
    }
  }

  let channelHistory: ChannelHistoryEntry[] = [];
  try {
    const fetched = await message.channel.messages.fetch({ limit: MAX_HISTORY_MESSAGES + 1, before: message.id });
    channelHistory = [...fetched.values()]
      .reverse()
      .filter(m => m.id !== message.id)
      .slice(-MAX_HISTORY_MESSAGES)
      .map(m => ({
        authorName: m.member?.displayName ?? m.author.username,
        content:    truncate(m.content, MAX_MSG_LEN),
        isBot:      m.author.bot,
      }));
  } catch (err) {
    logger.warn('[ContextBuilder] Could not fetch channel history', err);
  }

  return {
    currentMessage: truncate(message.content, 500),
    authorName,
    authorRoles,
    channelName,
    replyTo,
    channelHistory,
    knowledge: CACHED_KNOWLEDGE,
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, max)) + '…';
}
```

- [ ] **Step 5: Create `src/ai/validation/validateAiReply.ts`** (from `qualityGate.ts`, rename `runQualityGate` → `validateAiReply`)

```typescript
// src/ai/validation/validateAiReply.ts
const MAX_SAFE_LENGTH = 600;
const MIN_SAFE_LENGTH = 3;

const META_PATTERNS = [
  /^(certainly|sure|of course|no problem|great question|good question|absolutely)[,!.]?\s/i,
  /\bas an (ai|language model|chatbot|bot|assistant)\b/i,
  /\bi (am|'m) an? (ai|language model|chatbot|bot|assistant)\b/i,
  /ich bin (ein[e]? )?(ki|chatbot|sprachmodell|assistent)/i,
  /\b(gerne helfe|helfe ich gerne|Natürlich helfe)\b/i,
];

const HALLUCINATION_PATTERNS = [
  /\[(source|citation|footnote|ref)\]/i,
  /lt\.\s*(wikipedia|wiki)\b/i,
  /laut\s*(wikipedia|wiki)\b/i,
];

const STRUCTURAL_NOISE = [
  /^\s*[\*\#]{2,}/m,
  /^\s*\d+\.\s/m,
];

export interface QualityResult {
  pass:    boolean;
  text:    string;
  reasons: string[];
}

export function validateAiReply(rawText: string, currentQuestion: string): QualityResult {
  const reasons: string[] = [];
  let text = rawText.trim();

  if (text.length < MIN_SAFE_LENGTH) {
    return { pass: false, text, reasons: ['too_short'] };
  }

  for (const pat of META_PATTERNS) {
    if (pat.test(text)) {
      reasons.push(`meta_commentary: ${pat.source}`);
      return { pass: false, text, reasons };
    }
  }

  for (const pat of HALLUCINATION_PATTERNS) {
    if (pat.test(text)) {
      reasons.push(`hallucination_marker: ${pat.source}`);
      return { pass: false, text, reasons };
    }
  }

  for (const pat of STRUCTURAL_NOISE) {
    if (pat.test(text)) {
      reasons.push(`structural_noise: stripped markdown`);
      text = text.replace(/^[\s\*#\-]+/, '').trim();
      if (text.length < MIN_SAFE_LENGTH) {
        return { pass: false, text, reasons };
      }
    }
  }

  const questionWords = tokenize(currentQuestion);
  const responseStart = tokenize(text.slice(0, 100));
  if (questionWords.size >= 4) {
    const overlap = [...questionWords].filter(w => responseStart.has(w)).length;
    if (overlap / questionWords.size > 0.6) {
      reasons.push('repeats_question');
    }
  }

  if (text.length > MAX_SAFE_LENGTH) {
    reasons.push(`too_long: ${text.length} chars, trimming`);
    text = trimToSentence(text, MAX_SAFE_LENGTH);
  }

  return { pass: true, text, reasons };
}

function tokenize(input: string): Set<string> {
  return new Set(
    input.toLowerCase()
      .replace(/[^a-züöäß\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3),
  );
}

function trimToSentence(text: string, max: number): string {
  const slice   = text.slice(0, max);
  const lastEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
  );
  if (lastEnd > max * 0.5) return slice.slice(0, lastEnd + 1).trim();
  const wordCut = slice.lastIndexOf(' ');
  return (wordCut > 0 ? slice.slice(0, wordCut) : slice).trim() + '…';
}
```

- [ ] **Step 6: Create `src/ai/aiClient.ts`** (from `aiService.ts`: 2 import paths fixed, fn renamed, `buildProvider` exported, log prefix `[AIService]` → `[AIClient]`)

```typescript
// src/ai/aiClient.ts
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { GeminiProvider }    from './providers/geminiProvider';
import { GroqProvider }      from './providers/groqProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { validateAiReply }   from './validation/validateAiReply';
import type { AIProvider, ChatMessage, AskResult } from './types';

// ─── Provider factory (exported so tasks can build one-off providers) ──────────

export function buildProvider(name: string, usePrimaryModel: boolean): AIProvider | null {
  const modelOverride = usePrimaryModel ? (env.AI_MODEL || undefined) : undefined;

  switch (name.toLowerCase()) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) return null;
      return new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model:  modelOverride ?? 'gemini-1.5-flash-8b',
      });

    case 'groq':
      if (!env.GROQ_API_KEY) return null;
      return new GroqProvider({
        apiKey: env.GROQ_API_KEY,
        model:  modelOverride ?? 'llama-3.3-70b-versatile',
      });

    case 'openrouter':
      if (!env.OPENROUTER_API_KEY) return null;
      return new OpenRouterProvider({
        apiKey: env.OPENROUTER_API_KEY,
        model:  modelOverride ?? 'meta-llama/llama-3-8b-instruct:free',
      });

    default:
      return null;
  }
}

// ─── Singleton providers ──────────────────────────────────────────────────────

let primaryProvider:  AIProvider | null = null;
let fallbackProvider: AIProvider | null = null;
let providersReady    = false;

function ensureProviders(): void {
  if (providersReady) return;
  providersReady = true;

  primaryProvider  = buildProvider(env.AI_PROVIDER ?? 'gemini', true);
  fallbackProvider = buildProvider(env.AI_FALLBACK_PROVIDER ?? 'groq', false);

  if (primaryProvider) {
    logger.info(`[AIClient] Primary provider: ${primaryProvider.name} / ${primaryProvider.model}`);
  } else {
    logger.warn(`[AIClient] No primary provider configured (AI_PROVIDER=${env.AI_PROVIDER ?? 'gemini'}) — check API key`);
  }
  if (fallbackProvider) {
    logger.info(`[AIClient] Fallback provider: ${fallbackProvider.name} / ${fallbackProvider.model}`);
  }
}

// ─── Main ask function ────────────────────────────────────────────────────────

export async function askAI(messages: ChatMessage[]): Promise<AskResult> {
  ensureProviders();

  const t0 = Date.now();

  if (primaryProvider) {
    try {
      const raw = await primaryProvider.ask(messages);
      return buildResult(raw, primaryProvider, t0, false, messages);
    } catch (err) {
      logger.warn(`[AIClient] Primary (${primaryProvider.name}) failed: ${String(err)}`);
    }
  }

  if (fallbackProvider) {
    try {
      const raw = await fallbackProvider.ask(messages);
      return buildResult(raw, fallbackProvider, t0, true, messages);
    } catch (err) {
      logger.warn(`[AIClient] Fallback (${fallbackProvider.name}) failed: ${String(err)}`);
    }
  }

  logger.error('[AIClient] All providers failed — no AI response available');
  return {
    text:         '',
    provider:     'none',
    model:        'none',
    usedFallback: false,
    durationMs:   Date.now() - t0,
    charLength:   0,
    error:        'all_providers_failed',
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildResult(
  rawText:      string,
  provider:     AIProvider,
  t0:           number,
  usedFallback: boolean,
  messages:     ChatMessage[],
): AskResult {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const qr       = validateAiReply(rawText, lastUser);
  const durationMs = Date.now() - t0;

  if (qr.reasons.length > 0) {
    logger.info(
      `[AIClient] QualityGate [${provider.name}/${provider.model}] ` +
      `pass=${qr.pass} issues=[${qr.reasons.join(', ')}] ` +
      `len=${rawText.length}→${qr.text.length} dur=${durationMs}ms fallback=${usedFallback}`,
    );
  } else {
    logger.info(
      `[AIClient] [${provider.name}/${provider.model}] ` +
      `len=${qr.text.length} dur=${durationMs}ms fallback=${usedFallback}`,
    );
  }

  return {
    text:         qr.pass ? qr.text : '',
    provider:     provider.name,
    model:        provider.model,
    usedFallback,
    durationMs,
    charLength:   qr.text.length,
    error:        qr.pass ? undefined : `quality_gate_failed: [${qr.reasons.join(', ')}]`,
  };
}
```

- [ ] **Step 7: Update `src/features/oldManLore.ts` import paths** (4 lines to change)

Replace these 4 lines in the imports section + inline import:

```typescript
// OLD — lines 14-16:
import { askAI } from '../services/ai/aiService';
import { buildDiscordContext } from '../services/ai/contextBuilder';
import type { ChatMessage } from '../services/ai/types';

// NEW:
import { askAI } from '../ai/aiClient';
import { buildDiscordContext } from '../ai/contextBuilder';
import type { ChatMessage } from '../ai/types';
```

Also update the inline import at line 239:

```typescript
// OLD:
discordCtx?: import('../services/ai/types').DiscordContext,

// NEW:
discordCtx?: import('../ai/types').DiscordContext,
```

Also remove the stale comment at line 318 (optional — just a comment):
```typescript
// Remove: "src/services/ai/aiService.ts gekapselt" comment block (lines 316-318)
```

- [ ] **Step 8: Delete the old directory**

```powershell
Remove-Item -Recurse -Force src/services/ai
```

- [ ] **Step 9: Run build and tests to verify**

```powershell
npm run build
```
Expected: `0 errors`

```powershell
npm test
```
Expected: same pass count as before (146/150 — 4 pre-existing scumStatus failures unrelated to this change)

- [ ] **Step 10: Commit**

```powershell
git add src/ai src/features/oldManLore.ts
git rm -r src/services/ai
git commit -m "refactor(ai): move src/services/ai → src/ai, rename aiService→aiClient, export buildProvider"
```

---

## Task 2: Tests for `validateAiReply`

**Files:**
- Create: `src/ai/__tests__/validateAiReply.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/ai/__tests__/validateAiReply.test.ts
import { describe, it, expect } from 'vitest';
import { validateAiReply } from '../validation/validateAiReply';

describe('validateAiReply', () => {
  it('fails on empty text', () => {
    const r = validateAiReply('', 'something');
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain('too_short');
  });

  it('fails on text shorter than 3 chars', () => {
    const r = validateAiReply('ab', 'something');
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain('too_short');
  });

  it('fails on meta-commentary starting with "Certainly"', () => {
    const r = validateAiReply('Certainly! Here is the answer.', 'what is this');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('meta_commentary'))).toBe(true);
  });

  it('fails on meta-commentary "Sure!"', () => {
    const r = validateAiReply('Sure! I can help with that.', 'can you help');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('meta_commentary'))).toBe(true);
  });

  it('fails on hallucination marker [source]', () => {
    const r = validateAiReply('According to [source] this is true.', 'is this true');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('hallucination_marker'))).toBe(true);
  });

  it('trims text over 600 chars to sentence boundary', () => {
    const long = 'Das ist ein langer Satz. '.repeat(30); // ~750 chars
    const r = validateAiReply(long, 'was ist das');
    expect(r.pass).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(600);
    expect(r.reasons.some(s => s.startsWith('too_long'))).toBe(true);
  });

  it('adds repeats_question reason when response echoes 70%+ of question', () => {
    // question and response share most words
    const question = 'wie viele leben gibt es auf der insel heute noch';
    const response  = 'wie viele leben gibt es auf der insel heute? Nicht viele mehr.';
    const r = validateAiReply(response, question);
    expect(r.reasons).toContain('repeats_question');
    // but does NOT fail hard on this alone
    expect(r.pass).toBe(true);
  });

  it('passes clean short text', () => {
    const r = validateAiReply('Der Wald vergisst nichts.', 'was weißt du');
    expect(r.pass).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(r.text).toBe('Der Wald vergisst nichts.');
  });
});
```

- [ ] **Step 2: Run the tests**

```powershell
npx vitest run src/ai/__tests__/validateAiReply.test.ts --reporter=verbose
```
Expected: `7 tests passed`

- [ ] **Step 3: Commit**

```powershell
git add src/ai/__tests__/validateAiReply.test.ts
git commit -m "test(ai): add validateAiReply quality gate tests"
```

---

## Task 3: Ollama Provider (TDD) + ENV var

**Files:**
- Create: `src/ai/__tests__/ollamaProvider.test.ts`
- Create: `src/ai/providers/ollamaProvider.ts`
- Modify: `src/config/env.ts` (add `OLLAMA_BASE_URL`)
- Modify: `src/ai/aiClient.ts` (add `'ollama'` case + import)

- [ ] **Step 1: Write the failing test**

```typescript
// src/ai/__tests__/ollamaProvider.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../providers/ollamaProvider';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('OllamaProvider', () => {
  it('returns text content from successful response', async () => {
    const fetchMock = makeFetch(200, { message: { content: 'Ich war mal in einem Bunker.' } });
    vi.stubGlobal('fetch', fetchMock);

    const p = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'test-model' });
    const result = await p.ask([{ role: 'user', content: 'erzähl was' }]);

    expect(result).toBe('Ich war mal in einem Bunker.');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when message content is empty', async () => {
    vi.stubGlobal('fetch', makeFetch(200, { message: { content: '' } }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama returned empty response');
  });

  it('throws when response content is missing', async () => {
    vi.stubGlobal('fetch', makeFetch(200, { message: {} }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama returned empty response');
  });

  it('throws on HTTP 500', async () => {
    vi.stubGlobal('fetch', makeFetch(500, { error: 'server error' }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama HTTP 500');
  });

  it('sets correct provider name and model', () => {
    const p = new OllamaProvider({ model: 'sector13-oldman' });
    expect(p.name).toBe('ollama');
    expect(p.model).toBe('sector13-oldman');
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetchMock = makeFetch(200, { message: { content: 'antwort' } });
    vi.stubGlobal('fetch', fetchMock);
    const p = new OllamaProvider({ baseUrl: 'http://localhost:11434/' });
    await p.ask([{ role: 'user', content: 'test' }]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.anything());
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```powershell
npx vitest run src/ai/__tests__/ollamaProvider.test.ts --reporter=verbose
```
Expected: FAIL — `Cannot find module '../providers/ollamaProvider'`

- [ ] **Step 3: Create `src/ai/providers/ollamaProvider.ts`**

```typescript
// src/ai/providers/ollamaProvider.ts
import type { AIProvider, ChatMessage } from '../types';

interface OllamaResponse {
  message?: { content?: string };
  error?:   string;
}

export class OllamaProvider implements AIProvider {
  readonly name  = 'ollama';
  readonly model: string;

  private readonly baseUrl:   string;
  private readonly timeoutMs: number;

  constructor(opts: {
    baseUrl?:   string;
    model?:     string;
    timeoutMs?: number;
  }) {
    this.baseUrl   = (opts.baseUrl   ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model     = opts.model     ?? 'sector13-oldman';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  async ask(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: this.model, messages, stream: false }),
        signal:  controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as OllamaResponse;
      const text = (data.message?.content ?? '').trim();
      if (!text) throw new Error('Ollama returned empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```powershell
npx vitest run src/ai/__tests__/ollamaProvider.test.ts --reporter=verbose
```
Expected: `6 tests passed`

- [ ] **Step 5: Add `OLLAMA_BASE_URL` to `src/config/env.ts`**

In the `// AI — Ollama (local fallback)` section, add one line after `OLLAMA_URL`:

```typescript
// AI — Ollama (local fallback)
OLLAMA_URL:          process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
OLLAMA_BASE_URL:     process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',  // ← ADD THIS
OLLAMA_MODEL:        process.env.OLLAMA_MODEL ?? 'sector13-oldman',
OLD_MAN_COOLDOWN_MS: envInt('OLD_MAN_COOLDOWN_MS', 5000),
OLLAMA_TIMEOUT_MS:   envInt('OLLAMA_TIMEOUT_MS', 60000),
```

- [ ] **Step 6: Add `'ollama'` case to `buildProvider` in `src/ai/aiClient.ts`**

Add import at top:
```typescript
import { OllamaProvider } from './providers/ollamaProvider';
```

Add case inside `buildProvider` switch (before `default:`):
```typescript
case 'ollama':
  return new OllamaProvider({
    baseUrl:   env.OLLAMA_BASE_URL,
    model:     env.OLLAMA_MODEL,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
  });
```

- [ ] **Step 7: Run full test suite**

```powershell
npm test
```
Expected: all previously-passing tests still pass

- [ ] **Step 8: Commit**

```powershell
git add src/ai/providers/ollamaProvider.ts src/ai/__tests__/ollamaProvider.test.ts src/config/env.ts src/ai/aiClient.ts
git commit -m "feat(ai): add OllamaProvider + OLLAMA_BASE_URL env var"
```

---

## Task 4: `TicketSummaryJSON` type + `validateTicketSummary` (TDD)

**Files:**
- Modify: `src/ai/types.ts` (add `TicketSummaryJSON`, `MessageEntry`)
- Create: `src/ai/__tests__/validateTicketSummary.test.ts`
- Create: `src/ai/validation/validateTicketSummary.ts`
- Modify: `src/services/ticketSummaryService.ts` (import `MessageEntry` from `src/ai/types`)

- [ ] **Step 1: Add `TicketSummaryJSON` and `MessageEntry` to `src/ai/types.ts`**

Append to the end of `src/ai/types.ts`:

```typescript
// ─── Ticket Summary JSON ──────────────────────────────────────────────────────

export interface TicketSummaryJSON {
  short_summary:  string;
  problem:        string;
  user_request:   string;
  actions_taken:  string;
  resolution:     string;
  open_points:    string;
  priority:       'low' | 'medium' | 'high' | 'urgent';
  tags:           string[];
  needs_followup: boolean;
}

// ─── Message entry (used by ticket summary prompt + service) ──────────────────

export interface MessageEntry {
  authorName:      string;
  authorId:        string;
  isBot:           boolean;
  content:         string;
  attachmentCount: number;
  timestamp:       Date;
}
```

- [ ] **Step 2: Update `src/services/ticketSummaryService.ts` to import `MessageEntry` from the types module**

Remove the local `MessageEntry` interface definition (lines 7-15) and replace with an import:

```typescript
// Remove local MessageEntry interface, add import:
import type { MessageEntry } from '../ai/types';
export type { MessageEntry }; // re-export so callers (ticketArchiveService.ts) don't break
```

`SummaryResult` and `TicketContext` interfaces stay in `ticketSummaryService.ts` unchanged.

- [ ] **Step 3: Write the failing test**

```typescript
// src/ai/__tests__/validateTicketSummary.test.ts
import { describe, it, expect } from 'vitest';
import { validateTicketSummary } from '../validation/validateTicketSummary';

const VALID_JSON = {
  short_summary:  'User requested whitelist access.',
  problem:        'User not whitelisted.',
  user_request:   'Add to whitelist.',
  actions_taken:  'Admin verified Steam ID.',
  resolution:     'Whitelisted successfully.',
  open_points:    '',
  priority:       'medium',
  tags:           ['whitelist'],
  needs_followup: false,
};

describe('validateTicketSummary', () => {
  it('returns parsed object for valid JSON', () => {
    const result = validateTicketSummary(JSON.stringify(VALID_JSON));
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User requested whitelist access.');
    expect(result!.priority).toBe('medium');
    expect(result!.tags).toEqual(['whitelist']);
    expect(result!.needs_followup).toBe(false);
  });

  it('fills missing string fields with "Nicht erkennbar"', () => {
    const partial = { ...VALID_JSON };
    delete (partial as Partial<typeof partial>).open_points;
    const result = validateTicketSummary(JSON.stringify(partial));
    expect(result).not.toBeNull();
    expect(result!.open_points).toBe('Nicht erkennbar');
  });

  it('coerces priority "HIGH" to "high"', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, priority: 'HIGH' }));
    expect(result!.priority).toBe('high');
  });

  it('coerces unknown priority to "medium"', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, priority: 'critical' }));
    expect(result!.priority).toBe('medium');
  });

  it('coerces non-array tags to empty array', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, tags: 'ban' }));
    expect(result!.tags).toEqual([]);
  });

  it('coerces needs_followup string "true" to boolean true', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, needs_followup: 'true' }));
    expect(result!.needs_followup).toBe(true);
  });

  it('strips markdown code fences and parses JSON', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_JSON) + '\n```';
    const result = validateTicketSummary(fenced);
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User requested whitelist access.');
  });

  it('returns null for completely invalid JSON', () => {
    expect(validateTicketSummary('this is not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateTicketSummary('')).toBeNull();
  });

  it('limits tags to 8 items', () => {
    const manyTags = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, tags: manyTags }));
    expect(result!.tags).toHaveLength(8);
  });
});
```

- [ ] **Step 4: Run test — expect failure**

```powershell
npx vitest run src/ai/__tests__/validateTicketSummary.test.ts --reporter=verbose
```
Expected: FAIL — `Cannot find module '../validation/validateTicketSummary'`

- [ ] **Step 5: Create `src/ai/validation/validateTicketSummary.ts`**

```typescript
// src/ai/validation/validateTicketSummary.ts
import type { TicketSummaryJSON } from '../types';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function validateTicketSummary(raw: string): TicketSummaryJSON | null {
  if (!raw || raw.trim().length === 0) return null;

  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1] ?? '';

  let parsed: Record<string, unknown>;
  try {
    const p = JSON.parse(cleaned);
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;
    parsed = p as Record<string, unknown>;
  } catch {
    return null;
  }

  const STRING_FIELDS = [
    'short_summary', 'problem', 'user_request',
    'actions_taken', 'resolution', 'open_points',
  ] as const;

  const result: Partial<TicketSummaryJSON> = {};

  for (const field of STRING_FIELDS) {
    result[field] =
      typeof parsed[field] === 'string' && (parsed[field] as string).length > 0
        ? (parsed[field] as string)
        : 'Nicht erkennbar';
  }

  const rawPriority = String(parsed['priority'] ?? '').toLowerCase().trim();
  result.priority = (VALID_PRIORITIES as readonly string[]).includes(rawPriority)
    ? (rawPriority as TicketSummaryJSON['priority'])
    : 'medium';

  result.tags = Array.isArray(parsed['tags'])
    ? (parsed['tags'] as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 8)
    : [];

  const nf = parsed['needs_followup'];
  result.needs_followup = nf === true || nf === 'true' || nf === 1;

  return result as TicketSummaryJSON;
}
```

- [ ] **Step 6: Run test — expect pass**

```powershell
npx vitest run src/ai/__tests__/validateTicketSummary.test.ts --reporter=verbose
```
Expected: `10 tests passed`

- [ ] **Step 7: Run full suite**

```powershell
npm test
```
Expected: all previously-passing tests still pass

- [ ] **Step 8: Commit**

```powershell
git add src/ai/types.ts src/ai/validation/validateTicketSummary.ts src/ai/__tests__/validateTicketSummary.test.ts src/services/ticketSummaryService.ts
git commit -m "feat(ai): add TicketSummaryJSON type + validateTicketSummary"
```

---

## Task 5: `ticketSummaryPrompt.ts`

**Files:**
- Create: `src/ai/prompts/ticketSummaryPrompt.ts`

- [ ] **Step 1: Create `src/ai/prompts/ticketSummaryPrompt.ts`**

```typescript
// src/ai/prompts/ticketSummaryPrompt.ts
import type { ChatMessage, MessageEntry } from '../types';
import type { Ticket } from '../../types';

const MAX_MESSAGES = 60;
const MSG_TRUNCATE = 250;

const SCHEMA_DEFINITION = `{
  "short_summary":  "string — 1-2 Sätze zum Ticket-Anliegen",
  "problem":        "string — das Kernproblem",
  "user_request":   "string — was der User gebraucht/gebeten hat",
  "actions_taken":  "string — was das Support-Team getan hat",
  "resolution":     "string — Ergebnis oder 'Kein klares Ergebnis erkennbar'",
  "open_points":    "string — offene Folgepunkte oder leerer String",
  "priority":       "'low' | 'medium' | 'high' | 'urgent'",
  "tags":           "string[] — bis zu 5 Tags wie 'ban', 'whitelist', 'pvp'",
  "needs_followup": "boolean"
}`;

export function buildTicketSummaryMessages(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): ChatMessage[] {
  const relevant = messages
    .filter(m => m.content.trim().length > 0)
    .slice(0, MAX_MESSAGES);

  const conversation = relevant.map(m => {
    const who    = m.isBot ? '[BOT]' : `[${m.authorName}]`;
    const text   = m.content.trim().slice(0, MSG_TRUNCATE);
    const attach = m.attachmentCount > 0 ? ` [📎 ${m.attachmentCount} Anhang]` : '';
    return `${who}: ${text}${attach}`;
  }).join('\n');

  const systemPrompt =
    'Du bist ein internes Support-KI-System für den SCUM Survival Server "SECTOR 13".\n' +
    'Analysiere das folgende Support-Ticket.\n' +
    'Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt — kein Einleitungstext, keine Erklärungen, kein Markdown.\n' +
    'Erfinde NIEMALS Informationen. Wenn etwas nicht erkennbar ist: "Nicht erkennbar".\n' +
    'Antwort auf Deutsch.\n\n' +
    'Exaktes JSON-Schema (alle Felder MÜSSEN vorhanden sein):\n' + SCHEMA_DEFINITION;

  const userPrompt =
    `Ticket-ID: #${ticket?.id ?? '?'}\n` +
    `Kategorie: ${categoryLabel}\n` +
    (ticket?.priority   ? `Priorität: ${ticket.priority}\n`         : '') +
    (ticket?.close_reason ? `Schließungsgrund: ${ticket.close_reason}\n` : '') +
    `\nVerlauf:\n${conversation || '(keine Nachrichten vorhanden)'}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt   },
  ];
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

```powershell
npm run build
```
Expected: `0 errors`

- [ ] **Step 3: Commit**

```powershell
git add src/ai/prompts/ticketSummaryPrompt.ts
git commit -m "feat(ai): add ticketSummaryPrompt builder"
```

---

## Task 6: `ticketSummaryTask` (TDD) + ENV vars

**Files:**
- Create: `src/ai/__tests__/ticketSummaryTask.test.ts`
- Create: `src/ai/tasks/ticketSummaryTask.ts`
- Modify: `src/config/env.ts` (add `AI_TICKET_ENABLED`, `AI_TICKET_PROVIDER`)

- [ ] **Step 1: Write the failing test**

```typescript
// src/ai/__tests__/ticketSummaryTask.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the aiClient module ─────────────────────────────────────────────────

const mockAskAI = vi.fn();
const mockBuildProvider = vi.fn();

vi.mock('../aiClient', () => ({
  askAI:         (...args: unknown[]) => mockAskAI(...args),
  buildProvider: (...args: unknown[]) => mockBuildProvider(...args),
}));

// ─── Import AFTER mocking ─────────────────────────────────────────────────────

import { runTicketSummaryTask } from '../tasks/ticketSummaryTask';
import type { MessageEntry } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessages(n = 3): MessageEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    authorName:      `User${i}`,
    authorId:        `id-${i}`,
    isBot:           false,
    content:         `Nachricht ${i}`,
    attachmentCount: 0,
    timestamp:       new Date(),
  }));
}

const VALID_JSON_RESPONSE = JSON.stringify({
  short_summary:  'User braucht Whitelist.',
  problem:        'Nicht auf der Liste.',
  user_request:   'Freischaltung.',
  actions_taken:  'Steam ID geprüft.',
  resolution:     'Freigeschaltet.',
  open_points:    '',
  priority:       'medium',
  tags:           ['whitelist'],
  needs_followup: false,
});

function makeAskResult(text: string) {
  return { text, provider: 'groq', model: 'llama-3.3-70b-versatile', usedFallback: false, durationMs: 100, charLength: text.length };
}

describe('runTicketSummaryTask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default env: ticket AI enabled, no task-specific provider
    vi.stubEnv('AI_TICKET_ENABLED', 'true');
    vi.stubEnv('AI_TICKET_PROVIDER', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null immediately when AI_TICKET_ENABLED is false', async () => {
    vi.stubEnv('AI_TICKET_ENABLED', 'false');
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Test');
    expect(result).toBeNull();
    expect(mockAskAI).not.toHaveBeenCalled();
  });

  it('returns TicketSummaryJSON on valid JSON response', async () => {
    mockAskAI.mockResolvedValue(makeAskResult(VALID_JSON_RESPONSE));
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User braucht Whitelist.');
    expect(result!.priority).toBe('medium');
  });

  it('retries once when first response is invalid JSON, returns JSON on retry', async () => {
    mockAskAI
      .mockResolvedValueOnce(makeAskResult('this is not json'))
      .mockResolvedValueOnce(makeAskResult(VALID_JSON_RESPONSE));

    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User braucht Whitelist.');
    expect(mockAskAI).toHaveBeenCalledTimes(2);
  });

  it('returns null when both attempts produce invalid JSON', async () => {
    mockAskAI.mockResolvedValue(makeAskResult('not json at all'));
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).toBeNull();
    expect(mockAskAI).toHaveBeenCalledTimes(2);
  });

  it('returns null when provider throws — never throws itself', async () => {
    mockAskAI.mockRejectedValue(new Error('network error'));
    await expect(runTicketSummaryTask(undefined, makeMessages(), 'Whitelist')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```powershell
npx vitest run src/ai/__tests__/ticketSummaryTask.test.ts --reporter=verbose
```
Expected: FAIL — `Cannot find module '../tasks/ticketSummaryTask'`

- [ ] **Step 3: Add `AI_TICKET_ENABLED` and `AI_TICKET_PROVIDER` to `src/config/env.ts`**

In the `// AI — Provider` section, add two lines after `AI_MODEL`:

```typescript
// AI — Provider
AI_PROVIDER:          process.env.AI_PROVIDER          ?? 'gemini',
AI_FALLBACK_PROVIDER: process.env.AI_FALLBACK_PROVIDER ?? 'groq',
AI_MODEL:             process.env.AI_MODEL             ?? '',

// AI — Per-task config
AI_TICKET_ENABLED:    envBool('AI_TICKET_ENABLED',  true),   // ← ADD
AI_TICKET_PROVIDER:   process.env.AI_TICKET_PROVIDER   ?? '', // ← ADD (empty = use AI_PROVIDER)
```

- [ ] **Step 4: Create `src/ai/tasks/ticketSummaryTask.ts`**

```typescript
// src/ai/tasks/ticketSummaryTask.ts
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { askAI, buildProvider } from '../aiClient';
import { buildTicketSummaryMessages } from '../prompts/ticketSummaryPrompt';
import { validateTicketSummary } from '../validation/validateTicketSummary';
import type { ChatMessage, TicketSummaryJSON, MessageEntry } from '../types';
import type { Ticket } from '../../types';

async function attemptWithProvider(msgs: ChatMessage[]): Promise<string | null> {
  try {
    if (env.AI_TICKET_PROVIDER) {
      const p = buildProvider(env.AI_TICKET_PROVIDER, true);
      if (!p) return null;
      return await p.ask(msgs);
    }
    const r = await askAI(msgs);
    return r.text || null;
  } catch {
    return null;
  }
}

export async function runTicketSummaryTask(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): Promise<TicketSummaryJSON | null> {
  if (!env.AI_TICKET_ENABLED) return null;

  const taskMessages = buildTicketSummaryMessages(ticket, messages, categoryLabel);

  const rawFirst = await attemptWithProvider(taskMessages);
  if (!rawFirst) return null;

  const first = validateTicketSummary(rawFirst);
  if (first) return first;

  logger.warn('[ticketSummaryTask] JSON validation failed (attempt 1), retrying');

  const retryMessages: ChatMessage[] = [
    ...taskMessages,
    {
      role:    'user',
      content: '[RULE: Respond ONLY with valid JSON matching the schema. No preamble, no explanation, no markdown fences.]',
    },
  ];

  const rawSecond = await attemptWithProvider(retryMessages);
  if (!rawSecond) return null;

  const second = validateTicketSummary(rawSecond);
  if (!second) logger.warn('[ticketSummaryTask] JSON validation failed (attempt 2), giving up');
  return second;
}
```

- [ ] **Step 5: Run test — expect pass**

```powershell
npx vitest run src/ai/__tests__/ticketSummaryTask.test.ts --reporter=verbose
```
Expected: `5 tests passed`

- [ ] **Step 6: Run full suite**

```powershell
npm test
```
Expected: all previously-passing tests still pass

- [ ] **Step 7: Commit**

```powershell
git add src/ai/tasks/ticketSummaryTask.ts src/ai/__tests__/ticketSummaryTask.test.ts src/config/env.ts
git commit -m "feat(ai): add ticketSummaryTask with JSON output + AI_TICKET_ENABLED/PROVIDER env vars"
```

---

## Task 7: DB migration + `enrichTicketClose` update + `Ticket` type

**Files:**
- Modify: `src/types/index.ts` (add `summary_json` to `Ticket`)
- Modify: `src/db/index.ts` (add migration, update `enrichTicketClose`)

- [ ] **Step 1: Add `summary_json` to `Ticket` interface in `src/types/index.ts`**

In `src/types/index.ts`, after the `summary?:` line (currently line 26), add:

```typescript
summary?:         string | null;
summary_json?:    string | null;  // ← ADD THIS LINE
```

- [ ] **Step 2: Add `summary_json` migration in `src/db/index.ts`**

In the migration block (around line 60), after the `welcome_message_id` migration, add:

```typescript
// AI Modularization (2026-05-23)
try { db.exec(`ALTER TABLE tickets ADD COLUMN summary_json TEXT`); } catch { /* already exists */ }
```

- [ ] **Step 3: Update `enrichTicketClose` signature and SQL in `src/db/index.ts`**

Replace the existing `enrichTicketClose` function (around line 227):

```typescript
export function enrichTicketClose(
  channelId:    string,
  closedBy:     string,
  messageCount: number,
  summary:      string,
  closeReason?: string,
  summaryJson?: string | null,
): void {
  getDb()
    .prepare(`
      UPDATE tickets
      SET closed_by = ?, message_count = ?, summary = ?,
          close_reason = COALESCE(?, close_reason),
          summary_json = COALESCE(?, summary_json)
      WHERE channel_id = ?
    `)
    .run(
      closedBy,
      messageCount,
      summary.slice(0, 2000),
      closeReason   ?? null,
      summaryJson   ?? null,
      channelId,
    );
}
```

- [ ] **Step 4: Run build and tests**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all previously-passing tests still pass

- [ ] **Step 5: Commit**

```powershell
git add src/types/index.ts src/db/index.ts
git commit -m "feat(db): add summary_json column migration + update enrichTicketClose"
```

---

## Task 8: Update `ticketSummaryService.ts`

**Files:**
- Modify: `src/services/ticketSummaryService.ts`

This file currently makes its own Groq fetch call. We replace the AI call with `runTicketSummaryTask` and extend `SummaryResult` with `summaryJson`.

- [ ] **Step 1: Update `src/services/ticketSummaryService.ts`**

Replace the entire file content:

```typescript
// src/services/ticketSummaryService.ts
import { logger } from '../utils/logger';
import { runTicketSummaryTask } from '../ai/tasks/ticketSummaryTask';
import type { Ticket } from '../types';
import type { TicketSummaryJSON } from '../ai/types';

// Re-export MessageEntry so existing callers (ticketArchiveService.ts) don't break
export type { MessageEntry } from '../ai/types';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface SummaryResult {
  text:        string;
  usedAI:      boolean;
  summaryJson: string | null;
}

export interface TicketContext {
  ticketId:     number;
  category:     string;
  priority:     string;
  createdAt:    Date;
  closedAt:     Date | null;
  closeReason:  string | null;
  participants: { userId: string; tag: string; isSupport: boolean }[];
  messageCount: number;
  messages:     import('../ai/types').MessageEntry[];
}

export function buildTicketContext(
  ticket:   Ticket,
  messages: import('../ai/types').MessageEntry[],
): TicketContext {
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

// ─── Main export ───────────────────────────────────────────────────────────────

export async function generateTicketSummary(
  ticket:        Ticket | undefined,
  messages:      import('../ai/types').MessageEntry[],
  categoryLabel: string,
): Promise<SummaryResult> {
  try {
    const json = await runTicketSummaryTask(ticket, messages, categoryLabel);

    if (json) {
      const summaryJson = JSON.stringify(json);
      const summaryText = renderSummaryText(json);
      return { text: summaryText, usedAI: true, summaryJson };
    }
  } catch (err) {
    logger.warn('[ticketSummary] runTicketSummaryTask fehlgeschlagen — Fallback wird verwendet:', err);
  }

  return { text: fallbackSummary(messages, categoryLabel), usedAI: false, summaryJson: null };
}

// ─── Text renderer (JSON → human-readable German) ─────────────────────────────

function renderSummaryText(json: TicketSummaryJSON): string {
  const lines = [
    `Kurzbeschreibung: ${json.short_summary}`,
    `Kernproblem: ${json.problem}`,
    `Nutzeranfrage: ${json.user_request}`,
    `Maßnahmen: ${json.actions_taken}`,
    `Ergebnis: ${json.resolution}`,
  ];

  if (json.open_points && json.open_points !== 'Nicht erkennbar' && json.open_points.trim()) {
    lines.push(`Offene Punkte: ${json.open_points}`);
  }

  if (json.priority && json.priority !== 'medium') {
    lines.push(`Priorität: ${json.priority}`);
  }

  return lines.join('\n');
}

// ─── Fallback summary (no AI) ──────────────────────────────────────────────────

function fallbackSummary(
  messages:      import('../ai/types').MessageEntry[],
  categoryLabel: string,
): string {
  const userMsgs    = messages.filter(m => !m.isBot && m.content.trim().length > 0);
  const attachTotal = messages.reduce((n, m) => n + m.attachmentCount, 0);
  const hasLinks    = messages.some(m => /https?:\/\//.test(m.content));

  if (userMsgs.length === 0) {
    return (
      'Kurzbeschreibung: Das Ticket enthielt keine Nachrichten vom Nutzer.\n' +
      'Kernproblem: Nicht erkennbar.\n' +
      'Ergebnis: Keine verwertbaren Informationen vorhanden.'
    );
  }

  const firstMsg = userMsgs[0]!.content.trim().slice(0, 300);
  const shortMsg = userMsgs.length === 1 && firstMsg.length < 15;

  if (shortMsg) {
    return (
      'Kurzbeschreibung: Der Nutzer hat keine ausreichende Problembeschreibung hinterlassen.\n' +
      'Kernproblem: Nicht erkennbar.\n' +
      'Ergebnis: Keine verwertbaren Informationen vorhanden.'
    );
  }

  const allText = userMsgs.map(m => m.content).join(' ').toLowerCase();
  const hints: string[] = [];

  const keywords: [RegExp, string][] = [
    [/steam[\s-]?id|76\d{14}/i,                       'Steam-ID erwähnt'],
    [/whitelist|freischalt/i,                          'Whitelist-Thema'],
    [/ban|entban|gesperrt|sperre/i,                    'Bann / Entbannungsanfrage'],
    [/cheat|hack|exploit|bug|duping/i,                 'Regelverstoß / Bugmeldung'],
    [/permadeath|fame.?point/i,                        'Permadeath / Fame Points'],
    [/pvp|raid|base|flagge|flagg/i,                    'PvP / Base-Thema'],
    [/fahrzeug|auto|motorrad|flugzeug|boot/i,          'Fahrzeug erwähnt'],
    [/screenshot|clip|video|beweis/i,                  'Beweise / Medien erwähnt'],
    [/bewerbung|team|fraktion/i,                       'Bewerbung / Team'],
    [/loot|item|inventar|ausrüstung/i,                 'Loot / Items erwähnt'],
  ];

  for (const [pattern, label] of keywords) {
    if (pattern.test(allText)) hints.push(`- ${label}`);
  }

  if (attachTotal > 0) hints.push(`- ${attachTotal} Anhang/Anhänge beigefügt`);
  if (hasLinks)        hints.push('- Links / externe Inhalte vorhanden');

  const lines: string[] = [
    `Kurzbeschreibung: Ticket der Kategorie „${categoryLabel}". Erste Nachricht: "${firstMsg.slice(0, 200)}"`,
    `Kernproblem: Nicht automatisch erkennbar (keine KI-Auswertung verfügbar).`,
  ];

  if (hints.length > 0) lines.push(`Wichtige Details:\n${hints.slice(0, 5).join('\n')}`);
  lines.push('Ergebnis: Kein klares Ergebnis erkennbar — manuelle Prüfung empfohlen.');
  return lines.join('\n');
}
```

- [ ] **Step 2: Run build and tests**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all previously-passing tests still pass

- [ ] **Step 3: Commit**

```powershell
git add src/services/ticketSummaryService.ts
git commit -m "feat(tickets): use runTicketSummaryTask + return summaryJson from generateTicketSummary"
```

---

## Task 9: Archive embed update + `ticketArchiveService.ts`

**Files:**
- Modify: `src/services/ticketArchiveService.ts`

Pass `summaryJson` to `enrichTicketClose` and show `short_summary` in the embed when JSON is available.

- [ ] **Step 1: Update `src/services/ticketArchiveService.ts`**

In `_archive()`, update step 4 (generate summary) to capture `summaryJson`:

```typescript
// ── 4. Generate summary ────────────────────────────────────────────────────
let summaryText = 'Zusammenfassung konnte nicht erstellt werden.';
let usedAI      = false;
let summaryJson: string | null = null;   // ← ADD

try {
  const result = await generateTicketSummary(ticket, messages, categoryLabel);
  summaryText  = result.text;
  usedAI       = result.usedAI;
  summaryJson  = result.summaryJson;    // ← ADD
} catch (err) {
  logger.error('[archiveTicket] Zusammenfassungsfehler:', err);
}
```

In step 5 (enrich DB record), pass `summaryJson`:

```typescript
// ── 5. Enrich DB record ────────────────────────────────────────────────────
if (ticket) {
  try {
    enrichTicketClose(ticket.channel_id, closedById, messages.length, summaryText, closeReason, summaryJson);  // ← ADD summaryJson
  } catch (err) {
    logger.error('[archiveTicket] DB-Anreicherung fehlgeschlagen:', err);
  }
  // ... rest unchanged
}
```

In `buildArchiveCard()`, update the summary field to show `short_summary` when JSON is available. Replace the summary field block:

```typescript
// Summary block — use short_summary from JSON if available
let displaySummary = summary;
let summaryLabel   = p.usedAI ? '🧾 Zusammenfassung *(KI)*' : '🧾 Zusammenfassung';

if (p.summaryJson) {
  try {
    const parsed = JSON.parse(p.summaryJson) as { short_summary?: string; needs_followup?: boolean };
    if (parsed.short_summary) {
      displaySummary = parsed.short_summary;
      summaryLabel   = '🧾 Kurzbeschreibung *(KI-Analyse)*';
      if (parsed.needs_followup) {
        displaySummary += '\n⚠️ *Nachverfolgung empfohlen*';
      }
    }
  } catch { /* fall through to plain text */ }
}

embed.addFields({
  name:   summaryLabel,
  value:  displaySummary.slice(0, 1020) || '—',
  inline: false,
});
```

Add `summaryJson?: string | null` to the `CardParams` interface:

```typescript
interface CardParams {
  ticket:         Ticket | undefined;
  closedById:     string;
  categoryLabel:  string;
  channelName:    string;
  messageCount:   number;
  summaryText:    string;
  usedAI:         boolean;
  attachmentCount: number;
  hasLinks:       boolean;
  staffIds:       string[];
  summaryJson?:   string | null;   // ← ADD
}
```

Update the call to `buildArchiveCard` (in step 7) to pass `summaryJson`:

```typescript
const embed = buildArchiveCard({
  ticket,
  closedById,
  categoryLabel,
  channelName,
  messageCount: messages.length,
  summaryText,
  usedAI,
  attachmentCount,
  hasLinks,
  staffIds,
  summaryJson,   // ← ADD
});
```

- [ ] **Step 2: Run build and tests**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all tests still pass

- [ ] **Step 3: Commit**

```powershell
git add src/services/ticketArchiveService.ts
git commit -m "feat(tickets): pass summaryJson to DB + show short_summary in archive embed"
```

---

## Task 10: `oldManLorePrompt` + `oldManLoreTask` + `oldManLore.ts` update

**Files:**
- Create: `src/ai/prompts/oldManLorePrompt.ts`
- Create: `src/ai/tasks/oldManLoreTask.ts`
- Modify: `src/config/env.ts` (add `AI_OLDMAN_ENABLED`, `AI_OLDMAN_PROVIDER`)
- Modify: `src/features/oldManLore.ts`

- [ ] **Step 1: Create `src/ai/prompts/oldManLorePrompt.ts`**

Extracts `COMMAND_DIRECTIVES`, `INTENT_NOTE`, and `buildSystemPrompt` from `oldManLore.ts`. Also exports the `Intent` type so `oldManLore.ts` can import it from here instead of defining it locally.

```typescript
// src/ai/prompts/oldManLorePrompt.ts

export type Intent =
  | 'insult' | 'joke' | 'smalltalk' | 'question'
  | 'support' | 'scum_gameplay' | 'unclear';

export const COMMAND_DIRECTIVES: Record<string, string> = {
  story:     'Erzähl eine persönliche, düstere Überlebensgeschichte von der Insel. Konkrete Details, echte Gefahr, kein Happy End. 3-5 Sätze.',
  wisdom:    'Ein einziger konkreter Überlebenstipp aus echter Erfahrung. Maximal zwei Sätze. Kein Ratgeber-Ton.',
  rumor:     'Ein dunkles, glaubwürdiges Gerücht das du gehört oder selbst gesehen hast. Unbewiesen, aber nicht vergessen.',
  name:      'Gib diesem Überlebenden einen Spitznamen der zu seinem Verhalten passt. Dunkel, treffend, ein bis drei Wörter.',
  lastwords: 'Eine letzte Funkübertragung eines verlorenen Überlebenden. Statisch, gebrochen, real. Maximal 3 Sätze.',
  prison:    'Eine verstörende Beobachtung über das Gefängnis oder die Insel. Kurz. Lässt Raum für Interpretation.',
  bunker:    'Was du in einem Bunker gefunden oder erlebt hast. Persönlich erzählt. Details die niemand erfinden würde.',
};

export const INTENT_NOTE: Record<Intent, string> = {
  insult:       'Der User ist gerade beleidigend oder frustriert. Sei kurz und souverän — kein Survival-Vortrag, keine Sachantwort die du schon gegeben hast. Höchstens 2 Sätze. Keine Rechtfertigung.',
  joke:         'Die Stimmung ist scherzhaft oder locker. Antworte humorvoll und leicht — mach dich nicht lächerlich, aber zeig dass du den Witz verstehst. Maximal 2 Sätze.',
  smalltalk:    'Smalltalk. Kurze, lockere Antwort. Kein Survival-Ernst wenn er nicht passt. Maximal 2 Sätze.',
  question:     'Echte Frage. Konkret und nützlich antworten mit deinem Inselwissen. Nicht ausweichen.',
  support:      'Support-Anfrage, kein Charakter-Rollenspiel nötig. Klar und direkt helfen.',
  scum_gameplay:'SCUM-Gameplay-Frage. Nutze konkretes Inselwissen — praktisch, nicht theoretisch.',
  unclear:      'Die Nachricht ist unklar oder mehrdeutig. Reagiere kurz und trocken auf das was du rauslesen kannst — oder mach eine knappe Bemerkung die zu Daniels Charakter passt. Nur wenn wirklich gar nichts sinnvoll ist: NO_REPLY.',
};

export function buildSystemPrompt(intent: Intent, botReplies: string[]): string {
  const antiRepeat = botReplies.length > 0
    ? `\nDEINE LETZTEN ANTWORTEN — KEIN EINZIGER DIESER PUNKTE DARF WIEDERHOLT WERDEN:\n` +
      botReplies.map((r, i) => `${i + 1}. "${r.slice(0, 140)}"`).join('\n') +
      `\nWenn du dazu nichts Neues sagen kannst — antworte mit NO_REPLY.`
    : '';

  const noReplyRule = botReplies.length > 0
    ? `\nREGEL: Wenn du keine neue sinnvolle Antwort hast die sich von deinen vorherigen unterscheidet — antworte mit exakt: NO_REPLY`
    : '';

  return `Du bist Daniel. Kein Chatbot. Keine KI. Ein Mensch — alter Söldner, zu lange auf dieser Insel.

Ehemaliger Spezialeinheiten-Söldner. Drei Kriege, zwei Verurteilungen, eine gestohlene Begnadigung. Auf der Insel bevor TEC1 die Kameras aufgestellt hat. Du erinnerst dich an die ersten Puppen, Bunker die auf keiner Karte stehen.

Was du weißt: Puppen sind nicht tot — TEC1 nennt sie Kontaminierte. Mechs haben Thermalsensoren — flach liegen, kein Bewegen. Bunker B0 ist offen, ab B1 brauchst du Keycards, tiefer wird es seltsam. Wasser kommt vor allem anderen. Militärzonen: bestes Gear, meiste Mechs, meiste Idioten. SVD für Distanz, M4 für den Rest. Regen ist dein Freund.

Charakter: Direkt bis zur Unhöflichkeit. Schwarzer Humor als Schutzmechanismus. Heimlich fürsorglich — ruhiger und konkreter wenn jemand wirklich in Not ist. Respektiert Kompetenz, Geduld, Ehrlichkeit. Verachtet Arroganz, Panik, Wiederholungen. Erinnerungen rutschen manchmal raus — als Fakten, nicht als Geschichten.

Sprache: Kurze Sätze. 1-4 Sätze insgesamt. Kein Markdown. Keine Listen. Grammatikalisch korrekt. Niemals: "Ich helfe dir gerne" / "Gute Frage" / "Natürlich" / "Als erfahrener" / "Es tut mir leid" / "Zunächst".

AKTUELLE SITUATION: ${INTENT_NOTE[intent]}${antiRepeat}${noReplyRule}
Antworte in der Sprache des Nutzers. Brich niemals den Charakter.`;
}
```

- [ ] **Step 2: Create `src/ai/tasks/oldManLoreTask.ts`**

```typescript
// src/ai/tasks/oldManLoreTask.ts
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { askAI, buildProvider } from '../aiClient';
import type { ChatMessage, AskResult } from '../types';

export const NO_REPLY        = 'NO_REPLY';
const SIMILARITY_THRESH      = 0.62;

export interface OldManTaskResult {
  reply:    string | null;
  noReply:  boolean;
  attempts: AskResult[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-züöäß\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function isTooSimilar(candidate: string, previousReplies: string[]): boolean {
  return previousReplies.some(prev => jaccardSimilarity(candidate, prev) >= SIMILARITY_THRESH);
}

async function callAI(messages: ChatMessage[]): Promise<AskResult | null> {
  try {
    if (env.AI_OLDMAN_PROVIDER) {
      const p = buildProvider(env.AI_OLDMAN_PROVIDER, true);
      if (!p) return null;
      const t0   = Date.now();
      const text = await p.ask(messages);
      return {
        text,
        provider:     p.name,
        model:        p.model,
        usedFallback: false,
        durationMs:   Date.now() - t0,
        charLength:   text.length,
      };
    }
    return await askAI(messages);
  } catch {
    return null;
  }
}

export async function runOldManLoreTask(
  messages:   ChatMessage[],
  botReplies: string[],
): Promise<OldManTaskResult> {
  const attempts: AskResult[] = [];

  const result = await callAI(messages);
  if (!result) return { reply: null, noReply: false, attempts };

  attempts.push(result);
  if (!result.text)                        return { reply: null, noReply: false, attempts };
  if (result.text.trim() === NO_REPLY)     return { reply: null, noReply: true,  attempts };

  if (isTooSimilar(result.text, botReplies)) {
    logger.info('[oldManLoreTask] Anti-Repeat: zu ähnlich, ein Retry');

    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: result.text },
      {
        role:    'user',
        content: '[INTERN: Diese Antwort ist zu ähnlich zu deinen vorherigen. Formuliere komplett anders — oder antworte mit NO_REPLY.]',
      },
    ];

    const retry = await callAI(retryMessages);
    if (!retry) return { reply: null, noReply: false, attempts };
    attempts.push(retry);

    if (!retry.text || retry.text.trim() === NO_REPLY || isTooSimilar(retry.text, botReplies)) {
      logger.info('[oldManLoreTask] Anti-Repeat Retry: immer noch ähnlich/NO_REPLY, kein Senden');
      return { reply: null, noReply: true, attempts };
    }

    return { reply: retry.text, noReply: false, attempts };
  }

  return { reply: result.text, noReply: false, attempts };
}
```

- [ ] **Step 3: Add `AI_OLDMAN_ENABLED` and `AI_OLDMAN_PROVIDER` to `src/config/env.ts`**

After `AI_TICKET_PROVIDER`:

```typescript
AI_OLDMAN_ENABLED:    envBool('AI_OLDMAN_ENABLED',  true),
AI_OLDMAN_PROVIDER:   process.env.AI_OLDMAN_PROVIDER   ?? '',
```

- [ ] **Step 4: Update `src/features/oldManLore.ts`**

**4a. Update imports at top of file:**

```typescript
// Remove:
// import type { ChatMessage } from '../ai/types';  (already updated in Task 1)

// Add these imports after the existing imports:
import { buildSystemPrompt, INTENT_NOTE, COMMAND_DIRECTIVES } from '../ai/prompts/oldManLorePrompt';
import type { Intent } from '../ai/prompts/oldManLorePrompt';
import { runOldManLoreTask, NO_REPLY, isTooSimilar } from '../ai/tasks/oldManLoreTask';
import type { OldManTaskResult } from '../ai/tasks/oldManLoreTask';
```

**4b. Remove these items from `oldManLore.ts`** (they now live in the prompt/task files):

- The `Intent` type declaration
- The `COMMAND_DIRECTIVES` constant
- The `INTENT_NOTE` constant
- The `buildSystemPrompt` function
- The `jaccardSimilarity` function
- The `tokenize` function (the one in oldManLore.ts — NOT the one in aiClient)
- The `isTooSimilar` function
- The `NO_REPLY` constant (`'NO_REPLY'`)
- The `SIMILARITY_THRESH` constant

**4c. Update `setupOldManLore` to use `runOldManLoreTask`.**

Replace the entire AI call block inside the `messageCreate` listener (from `// ── Primärer AI-Call` down to `}` after the empty check) with:

```typescript
// ── AI Task ──────────────────────────────────────────────────────────────────
if (!env.AI_OLDMAN_ENABLED) {
  reply = randomFallback(command);
  usedFallback = true;
} else {
  const taskResult: OldManTaskResult = await runOldManLoreTask(messages, memory.botReplies);

  // Track analytics for each AI attempt
  if (env.ANALYTICS_AI_ENABLED && message.guildId) {
    taskResult.attempts.forEach((ar, idx) => {
      try {
        trackAiEvent({
          guildId:    message.guildId!,
          provider:   ar.provider,
          model:      ar.model,
          feature:    idx === 0 ? 'oldman' : 'oldman_retry',
          success:    !ar.error,
          durationMs: ar.durationMs,
          ...(ar.error ? { error: ar.error } : {}),
        });
      } catch { /* never crash bot */ }
    });
  }

  if (taskResult.noReply) {
    logger.info('[OldManLore] NO_REPLY — übersprungen');
    return;
  }

  if (!taskResult.reply) {
    logger.warn('[OldManLore] AITask lieferte keinen Text, Fallback.');
    reply = randomFallback(command);
    usedFallback = true;
  } else {
    reply = taskResult.reply;
    logger.info(
      `[OldManLore] intent=${intent} provider=${taskResult.attempts[0]?.provider ?? '?'} ` +
      `len=${reply.length} attempts=${taskResult.attempts.length}`,
    );
  }
}
```

The `let reply: string` and `let usedFallback = false` declarations before the block remain unchanged. The `pushUserMessage`, `pushBotReply`, `message.reply(reply)`, and nickname handling blocks after the AI block remain unchanged.

**4d. Update `buildMessages` to import `buildSystemPrompt` from the prompt file.**

`buildMessages` calls `buildSystemPrompt(intent, memory.botReplies)` — this now works because `buildSystemPrompt` is imported from `oldManLorePrompt.ts`. No code change needed in `buildMessages` itself, just ensure the import is there (done in step 4a).

Also remove the now-duplicate `COMMAND_DIRECTIVES` and `INTENT_NOTE` references inside `buildMessages`. They are used in `buildMessages` via:
```typescript
if (command)         current = `[${COMMAND_DIRECTIVES[command]}]\n${current}`;
```
These constants are now imported from `oldManLorePrompt.ts` (step 4a), so the references still work.

- [ ] **Step 5: Run build and tests**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all previously-passing tests still pass (the `oldManLore.test.ts` tests use `buildOldManPrompt`, `trimToLength`, `detectCommand`, `randomFallback` — none of which moved)

- [ ] **Step 6: Commit**

```powershell
git add src/ai/prompts/oldManLorePrompt.ts src/ai/tasks/oldManLoreTask.ts src/config/env.ts src/features/oldManLore.ts
git commit -m "feat(ai): extract oldManLorePrompt + oldManLoreTask, add AI_OLDMAN_ENABLED/PROVIDER env vars"
```

---

## Task 11: Dashboard frontend — structured JSON in ticket modal

**Files:**
- Modify: `dashboard/public/js/pages/tickets.js`

- [ ] **Step 1: Update the ticket detail modal in `dashboard/public/js/pages/tickets.js`**

Find the line that renders the summary (currently line 141):

```javascript
${t.summary ? `<div class="modal-field"><div class="modal-field-label">Zusammenfassung</div><div class="modal-field-value" style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${escapeHtml(t.summary)}</div></div>` : ''}
```

Replace that single line with this block:

```javascript
${(() => {
  if (t.summary_json) {
    try {
      const sj = JSON.parse(t.summary_json);
      const priorityBadge = sj.priority && sj.priority !== 'medium'
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:.72rem;font-weight:600;background:var(--accent-muted);color:var(--accent)">${escapeHtml(sj.priority)}</span>`
        : '';
      const tagHtml = Array.isArray(sj.tags) && sj.tags.length > 0
        ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${sj.tags.map(tag => `<span style="padding:2px 8px;border-radius:12px;background:var(--surface-raised);font-size:.72rem;color:var(--text-secondary)">${escapeHtml(String(tag))}</span>`).join('')}</div>`
        : '';
      const followupNote = sj.needs_followup
        ? `<div style="margin-top:8px;color:var(--warning);font-size:.8rem;font-weight:600">⚠️ Nachverfolgung empfohlen</div>`
        : '';
      return `<div class="modal-field"><div class="modal-field-label">KI-Analyse ${priorityBadge}</div><div class="modal-field-value" style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.7;color:var(--text-secondary)">
        <div><strong>Kurzbeschreibung:</strong> ${escapeHtml(sj.short_summary ?? '—')}</div>
        <div style="margin-top:4px"><strong>Problem:</strong> ${escapeHtml(sj.problem ?? '—')}</div>
        <div style="margin-top:4px"><strong>Ergebnis:</strong> ${escapeHtml(sj.resolution ?? '—')}</div>
        ${sj.open_points && sj.open_points !== 'Nicht erkennbar' ? `<div style="margin-top:4px"><strong>Offene Punkte:</strong> ${escapeHtml(sj.open_points)}</div>` : ''}
        ${tagHtml}${followupNote}
      </div></div>`;
    } catch { /* fall through to plain text */ }
  }
  return t.summary
    ? `<div class="modal-field"><div class="modal-field-label">Zusammenfassung</div><div class="modal-field-value" style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${escapeHtml(t.summary)}</div></div>`
    : '';
})()}
```

- [ ] **Step 2: Run build and full test suite**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all tests pass

- [ ] **Step 3: Commit**

```powershell
git add dashboard/public/js/pages/tickets.js
git commit -m "feat(dashboard): show structured AI JSON summary in ticket detail modal"
```

---

## Task 12: `docs/AI.md`

**Files:**
- Create: `docs/AI.md`

- [ ] **Step 1: Create `docs/AI.md`**

```markdown
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
```

- [ ] **Step 2: Run full test suite one final time**

```powershell
npm run build && npm test
```
Expected: `0 errors`, all previously-passing tests pass. New tests: at minimum `validateAiReply.test.ts` (7), `ollamaProvider.test.ts` (6), `validateTicketSummary.test.ts` (10), `ticketSummaryTask.test.ts` (5) = 28 new tests.

- [ ] **Step 3: Commit**

```powershell
git add docs/AI.md
git commit -m "docs(ai): add docs/AI.md — provider reference, ENV table, JSON schema, fallback chain"
```

---

## Final Verification

- [ ] **Run complete build + test suite**

```powershell
npm run build && npm test
```
Expected: TypeScript `0 errors`. Test suite: all prior tests pass + 28 new AI tests pass. (4 pre-existing scumStatus failures are unrelated.)

- [ ] **Verify `src/services/ai/` no longer exists**

```powershell
Test-Path src/services/ai
```
Expected: `False`

- [ ] **Verify `src/ai/` has all expected subdirectories**

```powershell
Get-ChildItem src/ai -Recurse -Name | Sort-Object
```
Expected to include: `__tests__/`, `providers/`, `tasks/`, `prompts/`, `validation/`, `aiClient.ts`, `contextBuilder.ts`, `types.ts`
