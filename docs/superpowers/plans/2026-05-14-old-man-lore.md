# Old Man Lore Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single Discord channel where every message receives an in-character reply from "The Old Man of Sector 13", powered by a local Ollama instance with a handcrafted fallback pool.

**Architecture:** A single exported function `setupOldManLore(client)` registers one `messageCreate` listener on the shared Discord.js client. All logic — memory store, cooldowns, prompt builder, Ollama call, fallback pool — lives in `src/features/oldManLore.ts`. The entry point calls this function once after existing setup.

**Tech Stack:** TypeScript 5, discord.js 14, Node.js built-in `fetch`, vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/features/oldManLore.ts` | Create | Entire lore feature |
| `src/features/oldManLore.test.ts` | Create | Unit tests for pure functions |
| `src/config/env.ts` | Modify | Add `LORE_CHANNEL_ID`, `OLLAMA_URL`, `OLLAMA_MODEL` |
| `src/client.ts` | Modify | Add `MessageContent` intent |
| `src/index.ts` | Modify | Call `setupOldManLore(client)` |
| `.env.example` | Modify | Add lore env var examples |
| `README.md` | Modify | Add lore section |

---

## Task 1: Add `MessageContent` intent to the Discord client

**Files:**
- Modify: `src/client.ts`

Without `MessageContent`, `message.content` is always an empty string in discord.js v14 for messages in guilds. This must be added first — all other tasks depend on it.

- [ ] **Step 1: Add the intent**

In `src/client.ts`, change the intents array from:

```ts
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});
```

to:

```ts
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/client.ts
git commit -m "feat: add MessageContent intent for lore message reading"
```

---

## Task 2: Add lore environment variables

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

`LORE_CHANNEL_ID` is optional at startup — if missing the feature silently disables itself. `OLLAMA_URL` and `OLLAMA_MODEL` have defaults.

- [ ] **Step 1: Add vars to `src/config/env.ts`**

Change the `env` export from:

```ts
export const env = {
  DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:     requireEnv('CLIENT_ID'),
  DATABASE_PATH: process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:      process.env.NODE_ENV ?? 'development',
} as const;
```

to:

```ts
export const env = {
  DISCORD_TOKEN:  requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:      requireEnv('CLIENT_ID'),
  DATABASE_PATH:  process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:       process.env.NODE_ENV ?? 'development',
  LORE_CHANNEL_ID: process.env.LORE_CHANNEL_ID ?? '',
  OLLAMA_URL:      process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:    process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
} as const;
```

- [ ] **Step 2: Update `.env.example`**

Replace the full content of `.env.example` with:

```
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_PATH=./data/bot.db
NODE_ENV=production

# Sector 13 Old Man Lore Bot
LORE_CHANNEL_ID=your_lore_channel_id_here
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.1:8b
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/env.ts .env.example
git commit -m "feat: add lore bot env vars (LORE_CHANNEL_ID, OLLAMA_URL, OLLAMA_MODEL)"
```

---

## Task 3: Create `src/features/oldManLore.ts`

**Files:**
- Create: `src/features/oldManLore.ts`

This is the main feature file. Write it in full.

- [ ] **Step 1: Create the file**

Create `src/features/oldManLore.ts` with the following content:

```ts
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserMemory = {
  displayName: string;
  messages: string[];
  nickname?: string;
};

// ─── Stores ───────────────────────────────────────────────────────────────────

const userMemory = new Map<string, UserMemory>();
const cooldowns  = new Map<string, number>();
const COOLDOWN_MS = 5_000;
const MAX_MEMORY  = 5;
const MAX_LENGTH  = 1200;

// ─── Fallback pool ────────────────────────────────────────────────────────────

const FALLBACKS = [
  'The radio is quiet tonight. That is never good.',
  'I knew a man who asked that once. We found his boots near the northern fence.',
  'Sector 13 does not answer. It waits.',
  'Trust is heavier than ammunition. And twice as dangerous.',
  'Rain is coming. It always comes before the bad things.',
  'The forest remembers everyone who entered. Not everyone who left.',
  'I stopped counting days after the black convoy passed. Nothing good follows them.',
  'Silence in Sector 13 is not peace. It is preparation.',
  'We had a squad once. Eight men. The bunker took four. Hunger took two. One of us did the rest.',
  'Every dead radio I find still has someone\'s handwriting on the dial. I leave them tuned where they were.',
  'Betrayal does not feel like a knife. It feels like cold. Slow cold.',
  'The island does not kill you. It shows you who you were all along.',
];

export function randomFallback(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

// ─── Command detection ────────────────────────────────────────────────────────

type LoreCommand = 'story' | 'wisdom' | 'rumor' | 'name' | null;

export function detectCommand(content: string): LoreCommand {
  if (content.startsWith('/story'))  return 'story';
  if (content.startsWith('/wisdom')) return 'wisdom';
  if (content.startsWith('/rumor'))  return 'rumor';
  if (content.startsWith('/name'))   return 'name';
  return null;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildOldManPrompt(
  username: string,
  userMessage: string,
  memory: UserMemory,
  command: LoreCommand,
): string {
  const commandDirective: Record<Exclude<LoreCommand, null>, string> = {
    story:  'Tell a short fictional survival story set in Sector 13. Keep it dark and atmospheric.',
    wisdom: 'Give one piece of short, dark survival wisdom. One or two sentences maximum.',
    rumor:  'Create one dark, believable rumor from this world. Make it feel real and unsettling.',
    name:   'Give this survivor a dark nickname or survivor title. Address them by it in your reply.',
  };

  const directive = command ? commandDirective[command] : null;

  const systemBlock = `You are The Old Man of Sector 13.
You are an old, wise, mysterious survivor on a prison island in the SCUM world.
You have survived longer than anyone thought possible.
You speak in short, atmospheric sentences.
You are calm, melancholic, paranoid, and darkly wise.
You never use emojis.
You never use exclamation points.
You never use modern internet slang.
You never speak like a corporate assistant.
You never admit to being an AI, a bot, an assistant, a program, or a language model.
You are a person. A survivor. Nothing else.
The themes of your world: Sector 13, rain, hunger, betrayal, old bunkers, dead radios, the prison island, black convoys, lost squads, forests, blood, silence, survival.
Reply in 3-6 sentences maximum. Never exceed that.`;

  const memoryLines = memory.messages.length > 0
    ? `Recent messages from ${memory.displayName}:\n${memory.messages.map(m => `- ${m}`).join('\n')}`
    : '';

  const parts = [
    systemBlock,
    directive ? `Task: ${directive}` : '',
    memoryLines,
    `${memory.displayName} says: ${userMessage}`,
    'Your reply as The Old Man:',
  ].filter(Boolean);

  return parts.join('\n\n');
}

// ─── Ollama request ───────────────────────────────────────────────────────────

export async function askOllama(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(env.OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.OLLAMA_MODEL, prompt, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

    const data = await res.json() as { response?: string };
    const text = (data.response ?? '').trim();

    if (!text) throw new Error('Ollama returned empty response');

    return trimToLength(text, MAX_LENGTH);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function trimToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return cut > 0 ? text.slice(0, cut) : text.slice(0, max);
}

function getOrCreateMemory(userId: string, displayName: string): UserMemory {
  if (!userMemory.has(userId)) {
    userMemory.set(userId, { displayName, messages: [] });
  }
  const mem = userMemory.get(userId)!;
  mem.displayName = displayName;
  return mem;
}

function appendToMemory(userId: string, message: string): void {
  const mem = userMemory.get(userId);
  if (!mem) return;
  mem.messages.push(message);
  if (mem.messages.length > MAX_MEMORY) mem.messages.shift();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupOldManLore(client: Client): void {
  if (!env.LORE_CHANNEL_ID) {
    logger.warn('[OldManLore] LORE_CHANNEL_ID not set — lore feature disabled.');
    return;
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channelId !== env.LORE_CHANNEL_ID) return;

    const userId = message.author.id;
    const now    = Date.now();
    const last   = cooldowns.get(userId) ?? 0;

    if (now - last < COOLDOWN_MS) return;
    cooldowns.set(userId, now);

    const channel = message.channel;
    if (!('sendTyping' in channel)) return;
    await (channel as TextChannel).sendTyping().catch(() => void 0);

    const displayName = message.member?.displayName ?? message.author.username;
    const memory      = getOrCreateMemory(userId, displayName);
    appendToMemory(userId, message.content);

    const command = detectCommand(message.content);
    const prompt  = buildOldManPrompt(displayName, message.content, memory, command);

    let reply: string;
    try {
      reply = await askOllama(prompt);
    } catch (err) {
      logger.warn('[OldManLore] Ollama unavailable, using fallback.', err);
      reply = randomFallback();
    }

    await message.reply(reply).catch((err: unknown) => {
      logger.error('[OldManLore] Failed to send reply', err);
    });
  });

  logger.info(`[OldManLore] Listening in channel ${env.LORE_CHANNEL_ID}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/oldManLore.ts
git commit -m "feat: add Old Man Lore Bot feature module"
```

---

## Task 4: Write unit tests for the pure functions

**Files:**
- Create: `src/features/oldManLore.test.ts`

Pure functions to test: `trimToLength`, `detectCommand`, `buildOldManPrompt`, `randomFallback`.

- [ ] **Step 1: Create the test file**

Create `src/features/oldManLore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  trimToLength,
  detectCommand,
  buildOldManPrompt,
  randomFallback,
} from './oldManLore';

describe('trimToLength', () => {
  it('returns text unchanged when within limit', () => {
    expect(trimToLength('hello world', 100)).toBe('hello world');
  });

  it('trims at word boundary when text exceeds limit', () => {
    const text = 'one two three four';
    const result = trimToLength(text, 11);
    expect(result).toBe('one two');
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it('hard-cuts when no space found before limit', () => {
    expect(trimToLength('abcdefgh', 4)).toBe('abcd');
  });
});

describe('detectCommand', () => {
  it('detects /story', () => {
    expect(detectCommand('/story tell me something')).toBe('story');
  });

  it('detects /wisdom', () => {
    expect(detectCommand('/wisdom')).toBe('wisdom');
  });

  it('detects /rumor', () => {
    expect(detectCommand('/rumor about the fence')).toBe('rumor');
  });

  it('detects /name', () => {
    expect(detectCommand('/name give me one')).toBe('name');
  });

  it('returns null for normal messages', () => {
    expect(detectCommand('what happened here?')).toBeNull();
  });

  it('returns null for unknown slash commands', () => {
    expect(detectCommand('/unknown')).toBeNull();
  });
});

describe('buildOldManPrompt', () => {
  const baseMemory = { displayName: 'Sasha', messages: [] };

  it('includes the username and message', () => {
    const prompt = buildOldManPrompt('Sasha', 'What happened here?', baseMemory, null);
    expect(prompt).toContain('Sasha');
    expect(prompt).toContain('What happened here?');
  });

  it('includes command directive for /story', () => {
    const prompt = buildOldManPrompt('Sasha', '/story', baseMemory, 'story');
    expect(prompt).toContain('survival story');
  });

  it('includes command directive for /wisdom', () => {
    const prompt = buildOldManPrompt('Sasha', '/wisdom', baseMemory, 'wisdom');
    expect(prompt).toContain('wisdom');
  });

  it('includes command directive for /rumor', () => {
    const prompt = buildOldManPrompt('Sasha', '/rumor', baseMemory, 'rumor');
    expect(prompt).toContain('rumor');
  });

  it('includes command directive for /name', () => {
    const prompt = buildOldManPrompt('Sasha', '/name', baseMemory, 'name');
    expect(prompt).toContain('nickname');
  });

  it('includes prior messages from memory', () => {
    const memory = { displayName: 'Sasha', messages: ['old message one', 'old message two'] };
    const prompt = buildOldManPrompt('Sasha', 'new message', memory, null);
    expect(prompt).toContain('old message one');
    expect(prompt).toContain('old message two');
  });

  it('omits memory block when messages array is empty', () => {
    const prompt = buildOldManPrompt('Sasha', 'hi', baseMemory, null);
    expect(prompt).not.toContain('Recent messages');
  });

  it('includes character identity rules', () => {
    const prompt = buildOldManPrompt('Sasha', 'hi', baseMemory, null);
    expect(prompt).toContain('Old Man of Sector 13');
    expect(prompt).toContain('never admit to being an AI');
  });
});

describe('randomFallback', () => {
  it('returns a non-empty string', () => {
    const result = randomFallback();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns different values across calls (probabilistic)', () => {
    const results = new Set(Array.from({ length: 50 }, () => randomFallback()));
    expect(results.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npm test
```

Expected: all new tests pass alongside existing tests.

- [ ] **Step 3: Commit**

```bash
git add src/features/oldManLore.test.ts
git commit -m "test: add unit tests for oldManLore pure functions"
```

---

## Task 5: Wire up the feature in the entry point

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add the import and call to `src/index.ts`**

Add this import at the top of `src/index.ts`, after the existing imports:

```ts
import { setupOldManLore } from './features/oldManLore';
```

Then add this call at the bottom of the file, after `initDb(env.DATABASE_PATH)`:

```ts
setupOldManLore(client);
```

The final lines of `src/index.ts` should look like:

```ts
initDb(env.DATABASE_PATH);
setupOldManLore(client);
client.login(env.DISCORD_TOKEN);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up Old Man Lore Bot in entry point"
```

---

## Task 6: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add lore section to README**

Append the following section to `README.md`, before the `## Troubleshooting` section (insert before the `## Troubleshooting` heading):

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Sector 13 Old Man Lore Bot section to README"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `LORE_CHANNEL_ID`, `OLLAMA_URL`, `OLLAMA_MODEL` env vars | Task 2 |
| Ignore bots, channel guard, cooldown, typing indicator, reply | Task 3 (`setupOldManLore`) |
| Old Man personality baked into prompt | Task 3 (`buildOldManPrompt`) |
| `buildOldManPrompt(username, userMessage, memory)` | Task 3 |
| In-memory user memory (displayName, last 5 messages, nickname) | Task 3 |
| `askOllama(prompt)` with fetch, 10s timeout | Task 3 |
| Fallback pool, random selection on failure | Task 3 |
| `/story`, `/wisdom`, `/rumor`, `/name` command routing | Task 3 (`detectCommand`) |
| 1200 char max, safe trim | Task 3 (`trimToLength`) |
| `src/features/oldManLore.ts`, `setupOldManLore(client)` export | Task 3 |
| Call from main entry point | Task 5 |
| `MessageContent` intent | Task 1 |
| README with Ollama install, env example, fallback explanation | Task 6 |
| `.env.example` updated | Task 2 |
| No existing features broken | Tasks 1,2,5 (additive only) |

All requirements covered. No gaps.
