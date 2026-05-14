import { Client, TextChannel } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserMemory = {
  displayName: string;
  messages: string[];
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

    const userInput = trimToLength(message.content, 500);
    const command   = detectCommand(userInput);
    const prompt    = buildOldManPrompt(userInput, memory, command);
    appendToMemory(userId, userInput);

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
