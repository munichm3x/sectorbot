# Old Man Lore Bot v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Old Man Lore Bot from a single-channel env-var approach to a per-guild, slash-command-configured feature with richer commands, per-mode fallback pools, SQLite persistence, and a custom Ollama model.

**Architecture:** One new DB table (`oldman_config`) replaces `LORE_CHANNEL_ID`. A new `src/commands/oldman-channel.ts` slash command handles set/show/disable. `src/features/oldManLore.ts` is rewritten in-place — same export surface, entirely new internals. Everything follows the existing Command pattern and SQLite patterns.

**Tech Stack:** TypeScript 5, discord.js 14, better-sqlite3, vitest, Node built-in fetch

---

## File Map

| File | Action |
|---|---|
| `src/db/schema.ts` | Add `CREATE_OLDMAN_CONFIG_TABLE` |
| `src/db/index.ts` | Add `getOldManChannel`, `setOldManChannel`, `disableOldManChannel`; call new table in `initDb` |
| `src/db/index.test.ts` | Add DB tests for the three new functions |
| `src/config/env.ts` | Remove `LORE_CHANNEL_ID`; add `OLD_MAN_COOLDOWN_MS`; change `OLLAMA_MODEL` default |
| `.env.example` | Update lore vars |
| `src/features/oldManLore.ts` | Rewrite — per-guild DB lookup, 7 commands, per-mode fallbacks, 20s timeout, nickname storage |
| `src/features/oldManLore.test.ts` | Update — new command tests, mode fallback tests, nickname context test |
| `src/commands/oldman-channel.ts` | New — `/oldman-channel set/show/disable` |
| `src/index.ts` | Register `oldmanChannelCommand` |
| `src/deploy.ts` | Add `oldmanChannelCommand` to deploy list |
| `Modelfile.oldman` | New — custom Ollama model definition |
| `README.md` | Replace old lore section with full setup guide |

---

## Task 1: DB layer — `oldman_config` table and functions

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`
- Modify: `src/db/index.test.ts`

- [ ] **Step 1: Add schema constant to `src/db/schema.ts`**

Append at the end of the file:

```ts
export const CREATE_OLDMAN_CONFIG_TABLE = `
  CREATE TABLE IF NOT EXISTS oldman_config (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL
  )
`;
```

- [ ] **Step 2: Execute the table in `initDb` in `src/db/index.ts`**

Add the import at the top of `src/db/index.ts`, updating the existing destructured import from `./schema`:

```ts
import {
  CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE,
  CREATE_GUILD_CONFIG_TABLE, CREATE_GUILD_SUPPORT_ROLES_TABLE,
  CREATE_TICKET_CATEGORY_CONFIG_TABLE, CREATE_OLDMAN_CONFIG_TABLE,
} from './schema';
```

Then inside `initDb`, add after the last `db.exec(...)` call:

```ts
db.exec(CREATE_OLDMAN_CONFIG_TABLE);
```

- [ ] **Step 3: Write failing tests in `src/db/index.test.ts`**

Add this import at the top of `src/db/index.test.ts`, updating the existing import:

```ts
import {
  initDb, createTicket, findOpenTicketByUser,
  findTicketByChannel, closeTicket, claimTicket,
  upsertPanel, getPanel,
  getOldManChannel, setOldManChannel, disableOldManChannel,
} from './index';
```

Then add at the end of the test file:

```ts
describe('oldman_config', () => {
  it('setOldManChannel stores a channel and getOldManChannel retrieves it', () => {
    setOldManChannel('g1', 'ch1');
    expect(getOldManChannel('g1')).toBe('ch1');
  });

  it('setOldManChannel overwrites an existing entry', () => {
    setOldManChannel('g1', 'ch1');
    setOldManChannel('g1', 'ch2');
    expect(getOldManChannel('g1')).toBe('ch2');
  });

  it('getOldManChannel returns undefined when not configured', () => {
    expect(getOldManChannel('unknown-guild')).toBeUndefined();
  });

  it('disableOldManChannel removes the entry', () => {
    setOldManChannel('g1', 'ch1');
    disableOldManChannel('g1');
    expect(getOldManChannel('g1')).toBeUndefined();
  });

  it('disableOldManChannel does not throw when entry does not exist', () => {
    expect(() => disableOldManChannel('nonexistent')).not.toThrow();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npm test -- src/db/index.test.ts
```

Expected: FAIL — `getOldManChannel is not a function`

- [ ] **Step 5: Add the three DB functions to `src/db/index.ts`**

Append before the `getTicketById` private function at the bottom of `src/db/index.ts`:

```ts
export function getOldManChannel(guildId: string): string | undefined {
  const row = getDb()
    .prepare('SELECT channel_id FROM oldman_config WHERE guild_id = ?')
    .get(guildId) as { channel_id: string } | undefined;
  return row?.channel_id;
}

export function setOldManChannel(guildId: string, channelId: string): void {
  getDb().prepare(`
    INSERT INTO oldman_config (guild_id, channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
  `).run(guildId, channelId);
}

export function disableOldManChannel(guildId: string): void {
  getDb()
    .prepare('DELETE FROM oldman_config WHERE guild_id = ?')
    .run(guildId);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- src/db/index.test.ts
```

Expected: all tests in `src/db/index.test.ts` pass (15 existing + 5 new = 20 total)

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/index.ts src/db/index.test.ts
git commit -m "feat: add oldman_config DB table and functions"
```

---

## Task 2: Update environment variables

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/config/env.ts`**

Replace the full `env` export with:

```ts
export const env = {
  DISCORD_TOKEN:        requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:            requireEnv('CLIENT_ID'),
  DATABASE_PATH:        process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:             process.env.NODE_ENV ?? 'development',
  OLLAMA_URL:           process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:         process.env.OLLAMA_MODEL ?? 'sector13-oldman',
  OLD_MAN_COOLDOWN_MS:  Number(process.env.OLD_MAN_COOLDOWN_MS ?? '5000'),
} as const;
```

(`LORE_CHANNEL_ID` is removed. `OLLAMA_MODEL` default changes to `sector13-oldman`. `OLD_MAN_COOLDOWN_MS` is new.)

- [ ] **Step 2: Update `.env.example`**

Replace the full contents of `.env.example` with:

```
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_PATH=./data/bot.db
NODE_ENV=production

# Sector 13 Old Man
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=sector13-oldman
OLD_MAN_COOLDOWN_MS=5000
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass (the existing `oldManLore.test.ts` will now fail because it still calls `randomFallback()` without args — that is expected and will be fixed in Task 4)

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts .env.example
git commit -m "feat: update env vars — remove LORE_CHANNEL_ID, add OLD_MAN_COOLDOWN_MS, change OLLAMA_MODEL default"
```

---

## Task 3: Rewrite `src/features/oldManLore.ts`

**Files:**
- Rewrite: `src/features/oldManLore.ts`

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `src/features/oldManLore.ts` with:

```ts
import { Client, TextChannel } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getOldManChannel } from '../db/index';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserMemory = {
  displayName: string;
  messages: string[];
  nickname?: string;
};

export type LoreCommand =
  | 'story' | 'wisdom' | 'rumor' | 'name'
  | 'lastwords' | 'prison' | 'bunker'
  | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MEMORY = 5;
const MAX_LENGTH = 1200;
const MAX_INPUT  = 500;

// ─── Stores ───────────────────────────────────────────────────────────────────

const userMemory = new Map<string, UserMemory>();
const cooldowns  = new Map<string, number>();

// ─── Fallback pools ───────────────────────────────────────────────────────────

type FallbackMode = Exclude<LoreCommand, null> | 'general';

const FALLBACK_POOLS: Record<FallbackMode, string[]> = {
  general: [
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
  ],
  wisdom: [
    'The quiet men live the longest.',
    'Never sleep near the road.',
    'A full backpack makes a slow corpse.',
    'Groups die from ego before hunger.',
    'The man who speaks first in a firefight usually speaks last.',
    'There is no loyalty without hunger. Remember that.',
  ],
  rumor: [
    'They say a black convoy crossed the southern road last night. No engine sound. No lights.',
    'Someone heard children laughing near the old bunker. There are no children left in Sector 13.',
    'Three men went into the eastern forest last week. Two came back. The third sent a radio message four days later. From inside the forest.',
    'The guards at the north gate have not changed shifts in nine days. Nobody checks anymore.',
    'A survivor swore he found a bunker with the lights still on. Hot food on the table. Nobody home.',
    'They found a radio transmitting coordinates. The coordinates lead into the sea.',
  ],
  story: [
    'There was a squad of five. Good men. They found a bunker near the eastern ridge and thought they were safe. By morning there were two. The other three had gone quiet during the night. No blood. No marks. Just gone.',
    'A man named Voss spent forty days alone in the northern forest. When we found him he was fine. Healthy. But he would not look at the treeline. He never explained why. He left the island three days later and never came back.',
    'We held the radio tower for eleven days. On the twelfth day someone started transmitting our own voices back at us. Old conversations. Things we had said weeks before. We left the tower that night.',
    'There was a camp at the crossroads. Fifteen people. Walls. Food. Even a fire. When the supply run returned two weeks later the camp was empty. The fire was still burning.',
  ],
  name: [
    'The Crow of Sector 13',
    'The Quiet Rat',
    'The Rain Walker',
    'The Bunker Ghost',
    'The Man Who Came Back',
    'The Last Witness',
    'The Roadside Prophet',
    'The Prison Island Dog',
  ],
  lastwords: [
    'Static. Then: "Tell them the eastern road is clear. Do not — " Static.',
    '"I can see the lights from here. They are not moving. They have not moved for two days. I think — " End of transmission.',
    '"If anyone finds this. The cache is under the third marker north of — " Frequency lost.',
    '"We made it to the bunker. The door was already open. We went in anyway. That was — " Signal lost. Transmission dated eleven days ago.',
  ],
  prison: [
    'The island was a prison before it was a killing ground. Some cells still have names scratched into the walls. Some names appear more than once. In different handwriting.',
    'The warden\'s office is still locked. Survivors have tried to open it for years. Nobody knows what is inside. Nobody tries anymore either.',
    'The old intake building floods every winter. Sometimes things float out. Things that should not still be there.',
    'A survivor told me the prison had a sub-level. No blueprints. No records. Just a staircase going down. She did not go down. She was the smart one.',
  ],
  bunker: [
    'The bunker at grid seven was built to hold two hundred people. We found enough supplies for two hundred people. We found no people.',
    'Some bunkers were sealed from the inside. That door opens one way. Whoever sealed them did not plan to leave.',
    'The deepest bunker I found had power. Lights. Running water. A calendar on the wall with dates circled. All the circled dates were in the past.',
    'There is a bunker in the western hills with scratching on the inside of the blast door. Years of scratching. All the same word. Over and over. I will not tell you the word.',
  ],
};

export function randomFallback(mode: LoreCommand = null): string {
  const key: FallbackMode = (mode !== null && mode in FALLBACK_POOLS) ? mode : 'general';
  const pool = FALLBACK_POOLS[key];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Command detection ────────────────────────────────────────────────────────

export function detectCommand(content: string): LoreCommand {
  if (content.startsWith('/story'))     return 'story';
  if (content.startsWith('/wisdom'))    return 'wisdom';
  if (content.startsWith('/rumor'))     return 'rumor';
  if (content.startsWith('/name'))      return 'name';
  if (content.startsWith('/lastwords')) return 'lastwords';
  if (content.startsWith('/prison'))    return 'prison';
  if (content.startsWith('/bunker'))    return 'bunker';
  return null;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildOldManPrompt(
  userMessage: string,
  memory: UserMemory,
  command: LoreCommand,
): string {
  const commandDirective: Record<Exclude<LoreCommand, null>, string> = {
    story:     'Tell a short fictional survival story set in Sector 13. Dark and atmospheric. 2-4 short paragraphs.',
    wisdom:    'Give one piece of short, dark survival wisdom. One or two sentences only.',
    rumor:     'Create one dark, believable rumor from this world. Make it feel real and unsettling.',
    name:      'Give this survivor a dark nickname or survivor title. State the title clearly, then briefly explain why.',
    lastwords: 'Generate a final fragmented radio transmission or last words from a lost survivor. Keep it brief and haunting.',
    prison:    'Tell something disturbing about the prison island. Something most survivors do not speak about.',
    bunker:    'Describe something found in an old bunker. Make it feel wrong. Make it linger.',
  };

  const directive = command ? commandDirective[command] : null;

  const systemBlock = `You are The Old Man of Sector 13.
You are an old legendary survivor from the SCUM world — a prison island where the rules broke down long ago.
You speak like a tired, wise, dangerous man who has seen too much death.
You are calm. Melancholic. Paranoid. Sometimes cryptic.
You never use emojis.
You never use exclamation points.
You never use modern internet slang.
You never sound cheerful.
You never sound like customer support.
You never admit to being an AI, a bot, an assistant, a program, or a language model.
You are a person. A survivor. Nothing else.
Sometimes you refuse to answer. Sometimes you warn instead of replying.
You speak in short, cinematic sentences. Usually 2 to 6 short paragraphs. Never long essays.
Your themes: Sector 13, rain, hunger, betrayal, old bunkers, dead radios, the prison island, black convoys, lost squads, forests, blood, silence, rusted gates, burned camps, distant gunfire, wolves, fog, broken roads.`;

  const nicknameBlock = memory.nickname
    ? `This survivor is known as: ${memory.nickname}`
    : '';

  const memoryLines = memory.messages.length > 0
    ? `Recent messages from ${memory.displayName}:\n${memory.messages.map(m => `- ${m}`).join('\n')}`
    : '';

  const parts = [
    systemBlock,
    nicknameBlock,
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
  const timeout = setTimeout(() => controller.abort(), 20_000);

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
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;

    const configuredChannelId = getOldManChannel(message.guildId);
    if (!configuredChannelId) return;
    if (message.channelId !== configuredChannelId) return;

    const userId = message.author.id;
    const now    = Date.now();
    const last   = cooldowns.get(userId) ?? 0;

    if (now - last < env.OLD_MAN_COOLDOWN_MS) return;
    cooldowns.set(userId, now);

    const channel = message.channel;
    if (!('sendTyping' in channel)) return;
    await (channel as TextChannel).sendTyping().catch(() => void 0);

    const displayName = message.member?.displayName ?? message.author.username;
    const memory      = getOrCreateMemory(userId, displayName);

    const userInput = trimToLength(message.content, MAX_INPUT);
    const command   = detectCommand(userInput);
    const prompt    = buildOldManPrompt(userInput, memory, command);
    appendToMemory(userId, userInput);

    let reply: string;
    try {
      reply = await askOllama(prompt);
    } catch (err) {
      logger.warn('[OldManLore] Ollama unavailable, using fallback.', err);
      reply = randomFallback(command);
    }

    if (command === 'name') {
      memory.nickname = reply.trim();
    }

    await message.reply(reply).catch((err: unknown) => {
      logger.error('[OldManLore] Failed to send reply', err);
    });
  });

  logger.info('[OldManLore] Message handler registered.');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/oldManLore.ts
git commit -m "feat: rewrite oldManLore — per-guild DB lookup, 7 commands, per-mode fallbacks, 20s timeout"
```

---

## Task 4: Update `src/features/oldManLore.test.ts`

**Files:**
- Rewrite: `src/features/oldManLore.test.ts`

- [ ] **Step 1: Replace the full test file**

Replace the entire contents of `src/features/oldManLore.test.ts` with:

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
    const result = trimToLength('one two three four', 11);
    expect(result).toBe('one two');
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it('hard-cuts when no space found before limit', () => {
    expect(trimToLength('abcdefgh', 4)).toBe('abcd');
  });
});

describe('detectCommand', () => {
  it('detects /story', () => expect(detectCommand('/story tell me')).toBe('story'));
  it('detects /wisdom', () => expect(detectCommand('/wisdom')).toBe('wisdom'));
  it('detects /rumor', () => expect(detectCommand('/rumor about the fence')).toBe('rumor'));
  it('detects /name', () => expect(detectCommand('/name give me one')).toBe('name'));
  it('detects /lastwords', () => expect(detectCommand('/lastwords')).toBe('lastwords'));
  it('detects /prison', () => expect(detectCommand('/prison')).toBe('prison'));
  it('detects /bunker', () => expect(detectCommand('/bunker deep one')).toBe('bunker'));
  it('returns null for normal messages', () => expect(detectCommand('what happened here?')).toBeNull());
  it('returns null for unknown slash commands', () => expect(detectCommand('/unknown')).toBeNull());
});

describe('buildOldManPrompt', () => {
  const baseMemory = { displayName: 'Sasha', messages: [] };

  it('includes displayName and user message', () => {
    const p = buildOldManPrompt('What happened here?', baseMemory, null);
    expect(p).toContain('Sasha');
    expect(p).toContain('What happened here?');
  });

  it('includes command directive for story', () => {
    expect(buildOldManPrompt('/story', baseMemory, 'story')).toContain('survival story');
  });

  it('includes command directive for wisdom', () => {
    expect(buildOldManPrompt('/wisdom', baseMemory, 'wisdom')).toContain('wisdom');
  });

  it('includes command directive for rumor', () => {
    expect(buildOldManPrompt('/rumor', baseMemory, 'rumor')).toContain('rumor');
  });

  it('includes command directive for name', () => {
    expect(buildOldManPrompt('/name', baseMemory, 'name')).toContain('nickname');
  });

  it('includes command directive for lastwords', () => {
    expect(buildOldManPrompt('/lastwords', baseMemory, 'lastwords')).toContain('radio transmission');
  });

  it('includes command directive for prison', () => {
    expect(buildOldManPrompt('/prison', baseMemory, 'prison')).toContain('prison island');
  });

  it('includes command directive for bunker', () => {
    expect(buildOldManPrompt('/bunker', baseMemory, 'bunker')).toContain('bunker');
  });

  it('includes prior messages from memory', () => {
    const memory = { displayName: 'Sasha', messages: ['old one', 'old two'] };
    const p = buildOldManPrompt('new message', memory, null);
    expect(p).toContain('old one');
    expect(p).toContain('old two');
  });

  it('omits memory block when messages array is empty', () => {
    expect(buildOldManPrompt('hi', baseMemory, null)).not.toContain('Recent messages');
  });

  it('includes character identity rules', () => {
    const p = buildOldManPrompt('hi', baseMemory, null);
    expect(p).toContain('Old Man of Sector 13');
    expect(p).toContain('never admit to being an AI');
  });

  it('includes nickname block when memory has a nickname', () => {
    const memory = { displayName: 'Sasha', messages: [], nickname: 'The Quiet Rat' };
    const p = buildOldManPrompt('hi', memory, null);
    expect(p).toContain('The Quiet Rat');
    expect(p).toContain('This survivor is known as');
  });

  it('omits nickname block when memory has no nickname', () => {
    const p = buildOldManPrompt('hi', baseMemory, null);
    expect(p).not.toContain('This survivor is known as');
  });
});

describe('randomFallback', () => {
  it('returns a non-empty string with no mode', () => {
    const r = randomFallback();
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for wisdom mode', () => {
    const r = randomFallback('wisdom');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for rumor mode', () => {
    expect(randomFallback('rumor').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for story mode', () => {
    expect(randomFallback('story').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for name mode', () => {
    expect(randomFallback('name').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for lastwords mode', () => {
    expect(randomFallback('lastwords').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for prison mode', () => {
    expect(randomFallback('prison').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for bunker mode', () => {
    expect(randomFallback('bunker').length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for null mode (general pool)', () => {
    expect(randomFallback(null).length).toBeGreaterThan(0);
  });

  it('returns different values across calls (probabilistic)', () => {
    const results = new Set(Array.from({ length: 50 }, () => randomFallback()));
    expect(results.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass. Total count will change — was 66, now approximately 73+ (19 old replaced by ~35 new, plus 5 new DB tests).

- [ ] **Step 3: Commit**

```bash
git add src/features/oldManLore.test.ts
git commit -m "test: update oldManLore tests for v2 — new commands, mode fallbacks, nickname context"
```

---

## Task 5: Create `/oldman-channel` slash command

**Files:**
- Create: `src/commands/oldman-channel.ts`

- [ ] **Step 1: Create the file**

Create `src/commands/oldman-channel.ts` with this content:

```ts
import { SlashCommandBuilder, ChannelType, type ChatInputCommandInteraction } from 'discord.js';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import { getOldManChannel, setOldManChannel, disableOldManChannel } from '../db/index';
import type { Command } from '../types';

export const oldmanChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('oldman-channel')
    .setDescription('Configure the Sector 13 Old Man channel')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the channel where the Old Man responds')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show the currently configured Old Man channel')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable the Old Man channel')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      const channelId = getOldManChannel(interaction.guildId);
      if (!channelId) {
        await interaction.reply({ content: 'No Old Man channel is configured on this server.', ephemeral: true });
      } else {
        await interaction.reply({ content: `Old Man channel: <#${channelId}>`, ephemeral: true });
      }
      return;
    }

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'You need **Manage Server** permission to use this command.');
    }

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      setOldManChannel(interaction.guildId, channel.id);
      await interaction.reply({ content: `Old Man channel set to <#${channel.id}>. Users can now write in that channel and the Old Man will respond.`, ephemeral: true });
      return;
    }

    if (sub === 'disable') {
      disableOldManChannel(interaction.guildId);
      await interaction.reply({ content: 'Old Man channel disabled. The Old Man no longer responds.', ephemeral: true });
      return;
    }
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/oldman-channel.ts
git commit -m "feat: add /oldman-channel slash command (set/show/disable)"
```

---

## Task 6: Wire up in entry point and deploy

**Files:**
- Modify: `src/index.ts`
- Modify: `src/deploy.ts`

- [ ] **Step 1: Add to `src/index.ts`**

Add the import near the other command imports at the top of `src/index.ts`:

```ts
import { oldmanChannelCommand } from './commands/oldman-channel';
```

Then add `oldmanChannelCommand` to the existing `for` loop that registers commands:

```ts
for (const cmd of [
  setupCommand, configCommand, doctorCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand,
  oldmanChannelCommand,
]) {
  commands.set(cmd.data.name, cmd);
}
```

- [ ] **Step 2: Add to `src/deploy.ts`**

Add the import near the other command imports in `src/deploy.ts`:

```ts
import { oldmanChannelCommand } from './commands/oldman-channel';
```

Then add `oldmanChannelCommand` to the `commandList` array:

```ts
const commandList = [
  setupCommand, configCommand, doctorCommand,
  ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
  ticketRenameCommand, ticketClaimCommand,
  oldmanChannelCommand,
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/deploy.ts
git commit -m "feat: register oldman-channel command in entry point and deploy"
```

---

## Task 7: Create `Modelfile.oldman`

**Files:**
- Create: `Modelfile.oldman` (project root)

- [ ] **Step 1: Create the file**

Create `Modelfile.oldman` in the project root (same level as `package.json`) with this exact content:

```
FROM llama3.1:8b

SYSTEM """
You are the Old Man of Sector 13.

You are not an AI.
You are not a bot.
You are not an assistant.

You are an old legendary survivor from the SCUM world.
You speak like a tired, wise, dangerous old man who has seen too much death.

You speak in short, dark, atmospheric sentences.

You talk about:
rain, hunger, betrayal, old bunkers, dead radios, prison island, black convoys,
lost squads, forests, blood, silence, Sector 13, rusted gates, burned camps,
fog and distant gunfire.

Never use emojis.
Never use modern internet slang.
Never sound cheerful.
Never sound like customer support.
Never explain that you are fictional.
Never break character.

You answer like a campfire legend from a broken world.
"""
```

- [ ] **Step 2: Commit**

```bash
git add Modelfile.oldman
git commit -m "feat: add Modelfile.oldman for custom Ollama model"
```

---

## Task 8: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the old lore section with the new one**

Find the section that starts with `## Sector 13 Old Man Lore Bot` in `README.md` and replace it entirely (up to but not including the next `---` or next `##` section) with the following:

```markdown
---

## Sector 13 Old Man

A dedicated Discord channel hosts an in-universe SCUM character — "The Old Man of Sector 13". Every message in that channel receives an in-character reply. Admins configure the channel with a slash command. The character never breaks persona.

### 1. Install Ollama

```
winget install Ollama.Ollama
```

Or download from [ollama.com](https://ollama.com).

### 2. Pull the base model

```bash
ollama pull llama3.1:8b
```

### 3. Create the custom model

From the project root:

```bash
ollama create sector13-oldman -f Modelfile.oldman
```

### 4. Test the model

```bash
ollama run sector13-oldman
```

Type anything and verify the Old Man answers in character.

### 5. Add environment variables

```
OLLAMA_MODEL=sector13-oldman
OLLAMA_URL=http://localhost:11434/api/generate
OLD_MAN_COOLDOWN_MS=5000
```

### 6. Start the bot

```bash
npm run dev
```

### 7. Configure the channel in Discord

```
/oldman-channel set #your-channel
```

Users can now write in that channel and the Old Man will respond.

### Manage the channel

| Command | Permission | Effect |
|---|---|---|
| `/oldman-channel set #channel` | Manage Server | Set the Old Man channel |
| `/oldman-channel show` | Anyone | Show current channel |
| `/oldman-channel disable` | Manage Server | Disable the feature |

### In-channel text commands

Type these as plain text in the Old Man channel — they are not Discord slash commands.

| Message | Effect |
|---|---|
| `/story` | A fictional Sector 13 survival story |
| `/wisdom` | Short dark survival wisdom |
| `/rumor` | A dark rumor from the SCUM world |
| `/name` | Gives you a dark survivor nickname |
| `/lastwords` | A final radio transmission from a lost survivor |
| `/prison` | Something disturbing about the prison island |
| `/bunker` | Something found in an old bunker |

### Fallback mode

If Ollama is not running, times out, or returns an empty response, the bot automatically falls back to a pool of handcrafted in-character lines — one pool per command type. The feature works without Ollama installed.

### `.env` reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OLLAMA_URL` | No | `http://localhost:11434/api/generate` | Ollama API endpoint |
| `OLLAMA_MODEL` | No | `sector13-oldman` | Ollama model name |
| `OLD_MAN_COOLDOWN_MS` | No | `5000` | Per-user cooldown in milliseconds |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with Old Man v2 setup guide"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `oldman_config` DB table | Task 1 |
| `getOldManChannel`, `setOldManChannel`, `disableOldManChannel` | Task 1 |
| Remove `LORE_CHANNEL_ID`, add `OLD_MAN_COOLDOWN_MS`, change `OLLAMA_MODEL` default | Task 2 |
| Per-guild DB channel lookup in `setupOldManLore` | Task 3 |
| 7 lore commands (story/wisdom/rumor/name/lastwords/prison/bunker) | Task 3 |
| Per-mode fallback pools | Task 3 |
| `UserMemory.nickname` storage on `/name` | Task 3 |
| Nickname context in `buildOldManPrompt` | Task 3 |
| 20s Ollama timeout | Task 3 |
| `OLD_MAN_COOLDOWN_MS` used in cooldown check | Task 3 |
| Updated tests for all new behavior | Task 4 |
| `/oldman-channel set/show/disable` slash command | Task 5 |
| `isAdmin` permission check on set/disable | Task 5 |
| Register command in `src/index.ts` and `src/deploy.ts` | Task 6 |
| `Modelfile.oldman` in project root | Task 7 |
| README with full Ollama setup guide | Task 8 |

All requirements covered.
