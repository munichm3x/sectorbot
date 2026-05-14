# Sector 13 Old Man Lore Bot v2 — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Supersedes:** `2026-05-14-old-man-lore-design.md`

---

## Overview

Upgrade the existing Old Man Lore Bot from a single-channel env-var approach to a full per-guild, slash-command-configured feature. Admins use `/oldman-channel set` to designate any channel on their server. The Old Man responds to all messages in that channel with Ollama-generated or fallback in-character replies. Channel config persists in SQLite and survives restarts.

---

## Architecture

**Approach:** Option A — upgrade in-place. Rewrite `src/features/oldManLore.ts`, add one new slash command file, extend the DB layer with one new table. Everything follows the existing `Command` pattern and SQLite patterns exactly.

---

## Files Changed

| File | Action | Responsibility |
|---|---|---|
| `src/features/oldManLore.ts` | Rewrite | Message handler, prompt builder, Ollama client, fallback pools, memory |
| `src/features/oldManLore.test.ts` | Update | Unit tests for updated pure functions |
| `src/commands/oldman-channel.ts` | New | `/oldman-channel` slash command (set/show/disable) |
| `src/db/schema.ts` | Edit | Add `CREATE_OLDMAN_CONFIG_TABLE` |
| `src/db/index.ts` | Edit | Add `getOldManChannel`, `setOldManChannel`, `disableOldManChannel` |
| `src/index.ts` | Edit | Register `oldmanChannelCommand` |
| `src/deploy.ts` | Edit | Add `oldmanChannelCommand` to deploy list |
| `src/config/env.ts` | Edit | Remove `LORE_CHANNEL_ID`, add `OLD_MAN_COOLDOWN_MS` |
| `.env.example` | Edit | Update lore vars |
| `Modelfile.oldman` | New | Custom Ollama model definition |
| `README.md` | Edit | Full Ollama setup guide, replace old lore section |

---

## Database

### New table: `oldman_config`

```sql
CREATE TABLE IF NOT EXISTS oldman_config (
  guild_id   TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL
)
```

Added to `src/db/schema.ts` and executed in `initDb()`.

### New DB functions in `src/db/index.ts`

```ts
getOldManChannel(guildId: string): string | undefined
setOldManChannel(guildId: string, channelId: string): void  // upsert
disableOldManChannel(guildId: string): void                 // delete row
```

---

## Slash Command: `/oldman-channel`

File: `src/commands/oldman-channel.ts`  
Follows the existing `Command` interface (`data: SlashCommandBuilder`, `execute(interaction)`).

### Subcommands

| Subcommand | Args | Permission | Behaviour |
|---|---|---|---|
| `set` | `channel` (required, channel type) | ManageGuild | Calls `setOldManChannel(guildId, channelId)`, replies ephemeral confirmation |
| `show` | — | anyone | Reads `getOldManChannel(guildId)`, replies ephemeral with channel mention or "not configured" |
| `disable` | — | ManageGuild | Calls `disableOldManChannel(guildId)`, replies ephemeral confirmation |

Permission check uses existing `isAdmin(member)` from `src/services/permissionService.ts`.  
All replies are ephemeral.

---

## `src/features/oldManLore.ts`

### Changes from v1

| Aspect | v1 | v2 |
|---|---|---|
| Channel lookup | `env.LORE_CHANNEL_ID` (single, global) | `getOldManChannel(message.guildId)` (per-guild, DB) |
| Cooldown source | Hardcoded `5000` | `env.OLD_MAN_COOLDOWN_MS` (default `5000`) |
| Ollama timeout | 10s | 20s |
| Commands | story, wisdom, rumor, name | + lastwords, prison, bunker |
| Fallbacks | 1 general pool | Per-mode pools (general, wisdom, rumor, story, name, lastwords, prison, bunker) |
| `UserMemory` | `{ displayName, messages[] }` | `{ displayName, messages[], nickname? }` |
| `OLLAMA_MODEL` default | `llama3.1:8b` | `sector13-oldman` |
| Character prompt | Basic | Full spec: refusal behavior, cinematic style, all themes |

### `LoreCommand` type

```ts
type LoreCommand = 'story' | 'wisdom' | 'rumor' | 'name' | 'lastwords' | 'prison' | 'bunker' | null;
```

### `UserMemory` type

```ts
type UserMemory = {
  displayName: string;
  messages: string[];    // last 5, oldest first
  nickname?: string;     // set by /name, included in prompt context
};
```

### `buildOldManPrompt(userMessage, memory, command)`

Assembles:
1. **System block** — full character identity, prohibitions (never admit AI/bot/assistant), style rules (short sentences, cinematic, no emojis, no slang, 2–6 short paragraphs, may refuse or warn instead of answering), full theme list
2. **Nickname context** — if `memory.nickname` is set, include "This survivor is known as: [nickname]"
3. **Command directive** — per-mode instruction if command is non-null; for `name` command, directive instructs generating a title and storing it
4. **Memory block** — last up to 5 prior messages from this user
5. **Current message** — `"[displayName] says: [userMessage]"`
6. **Prompt footer** — `"Your reply as The Old Man:"`

### Fallback pools (per mode)

- **general** (12 entries): existing pool, extended
- **wisdom** (6 entries): short dark survival aphorisms
- **rumor** (6 entries): dark, believable SCUM world rumors
- **story** (4 entries): short dark survival story openers
- **name** (8 entries): dark survivor titles (The Crow of Sector 13, The Quiet Rat, etc.)
- **lastwords** (4 entries): final radio transmission fragments
- **prison** (4 entries): disturbing prison island observations
- **bunker** (4 entries): old bunker descriptions

### `/name` command special handling

When the Old Man generates a nickname (either from Ollama or fallback pool), extract it and store in `memory.nickname`. On subsequent prompts include it in the context block.

Extraction strategy: after getting the reply, if the command was `name`, store the full reply as the nickname (trimmed). It will be surfaced in the context block on next messages.

### `askOllama(prompt)`

- Same structure as v1
- Timeout increased to 20s
- Returns `trimToLength(text, MAX_LENGTH)` where `MAX_LENGTH = 1200`

### Guard chain in `messageCreate`

1. Ignore bots
2. Ignore DMs (`!message.guildId`)
3. Look up `getOldManChannel(message.guildId)` — skip if undefined
4. Skip if `message.channelId !== configuredChannelId`
5. Per-user cooldown (`OLD_MAN_COOLDOWN_MS`)
6. Typing indicator
7. Input trim (500 chars)
8. Memory update + command detection + prompt build
9. `askOllama` → fallback on error
10. `message.reply`

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LORE_CHANNEL_ID` | — | — | **Removed** |
| `OLLAMA_URL` | No | `http://localhost:11434/api/generate` | unchanged |
| `OLLAMA_MODEL` | No | `sector13-oldman` | default changed from `llama3.1:8b` |
| `OLD_MAN_COOLDOWN_MS` | No | `5000` | new |

---

## `Modelfile.oldman`

Created in the project root:

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

---

## README Update

Replace the existing lore section with a new "Sector 13 Old Man" section covering:

1. Install Ollama: `winget install Ollama.Ollama`
2. Pull base model: `ollama pull llama3.1:8b`
3. Create custom model: `ollama create sector13-oldman -f Modelfile.oldman`
4. Test: `ollama run sector13-oldman`
5. Add env vars: `OLLAMA_MODEL=sector13-oldman`, `OLLAMA_URL=...`, `OLD_MAN_COOLDOWN_MS=5000`
6. Start bot
7. In Discord: `/oldman-channel set #your-channel`
8. Users write in that channel, the Old Man replies

Also include:
- `/oldman-channel show` and `disable` documentation
- In-channel text commands table (`/story`, `/wisdom`, `/rumor`, `/name`, `/lastwords`, `/prison`, `/bunker`)
- Fallback mode explanation
- Note that text commands are plain-text prefixes, not Discord slash commands

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No channel configured for guild | `messageCreate` guard skips silently |
| Ollama timeout / unreachable | Log warn, use mode-specific fallback |
| Ollama empty response | Treated as failure, use fallback |
| `message.reply` fails | Log error, swallow — no crash |
| `/oldman-channel set` in DM | `interaction.inCachedGuild()` guard returns early |

---

## Testing

Update `src/features/oldManLore.test.ts`:

- `detectCommand`: add `lastwords`, `prison`, `bunker` detection tests
- `buildOldManPrompt`: add nickname context test, verify new command directives
- `randomFallback(mode)`: verify each mode returns non-empty string
- `trimToLength`: unchanged
- All 66 existing tests must continue to pass

---

## Out of Scope

- Persistent user memory across restarts
- Per-guild Ollama model selection
- Rate limiting beyond per-user cooldown
- Old Man channel moderation (deleting off-topic messages)
