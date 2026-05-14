import { Client, TextChannel } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getOldManChannel } from '../db/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoreCommand = 'story' | 'wisdom' | 'rumor' | 'name' | 'lastwords' | 'prison' | 'bunker' | null;

type UserMemory = {
  displayName: string;
  messages: string[];    // last 5, oldest first
  nickname?: string;     // set by /name command, included in prompt context
};

// ─── Stores ───────────────────────────────────────────────────────────────────

const userMemory = new Map<string, UserMemory>();
const cooldowns  = new Map<string, number>();
const MAX_MEMORY = 5;
const MAX_LENGTH = 1200;

// ─── Fallback pools ───────────────────────────────────────────────────────────

const FALLBACK_POOLS: Record<NonNullable<LoreCommand> | 'general', string[]> = {
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
    'A man who sleeps near fire is warm once. A man who plans where to sleep is warm every night.',
    'The dead do not mourn. Only the living carry that weight.',
    'Every bullet you fire is a decision. Make sure it was the right one.',
    'Hunger is honest. It never pretends to be something else.',
    'Learn the sound of silence before something breaks it.',
    'The ones who survived longest were not the strongest. They were the quietest.',
  ],
  rumor: [
    'They say the eastern bunker still has power. Nobody who went to check came back to confirm it.',
    'A squad found a locked convoy truck near the swamp. They heard something moving inside. They left it locked.',
    'The old guard tower near the prison wall goes dark every third night. Someone is turning the lights off from inside.',
    'A voice on channel seven repeats the same coordinates every hour. The coordinates lead to a field of unmarked graves.',
    'They say a player found a full camp — food, fire still hot, gear stacked neat — but no one there. Not abandoned. Just empty.',
    'There is a name carved into every tree along the northern trail. Always the same name. Nobody knows who did it.',
  ],
  story: [
    'I was in a squad of four once. We found a bunker east of the river. The door was already open. That was the first mistake.',
    'The rain started three days before we found the convoy. I remember because we had been counting everything by then — bullets, meals, hours.',
    'There was a man they called the Cartographer. He mapped every road on the island. He was the first one taken by the black convoy.',
    'We held a position for eleven days. Nobody attacked us. On the twelfth day we realized nobody needed to.',
  ],
  name: [
    'The Crow of Sector 13',
    'The Quiet Rat',
    'Dead Signal',
    'The Hollow',
    'Last Light of the East Fence',
    'The One the Rain Follows',
    'Pale Road',
    'Grey Smoke',
  ],
  lastwords: [
    'Static, then a voice: "Tell them the gate was already open when we arrived—" Then nothing.',
    'A single transmission on loop: "Seven days. We tried." Then silence.',
    'Barely audible through interference: "It wasn\'t the island that got us. It was each other." Click.',
    'Last recorded words found on a dead radio: "I don\'t regret the ones I lost. I regret the one I trusted."',
  ],
  prison: [
    'The old prison block still has names scratched into the walls. Hundreds of them. Some are scratched out.',
    'There is a wing of the prison that was sealed from the inside. No tools were found near the sealed door.',
    'The warden\'s office has a logbook. The last entries are not in any language anyone recognizes.',
    'A cell in block D still has a meal on the floor. Untouched. It has been there longer than anyone has been on this island.',
  ],
  bunker: [
    'The old bunker near the ridge has three rooms. Two are empty. The third is locked. The lock is bolted from the inside.',
    'Bunker Seven had a full supply cache. Someone had eaten everything and left the empty cans arranged in a circle.',
    'There is a bunker that does not appear on any map. Survivors who find it do not stay long.',
    'The walls of the deep bunker are covered in tallies. Someone was counting days. They reached four hundred and twelve.',
  ],
};

export function randomFallback(mode: LoreCommand = null): string {
  const pool = mode !== null && mode in FALLBACK_POOLS
    ? FALLBACK_POOLS[mode as keyof typeof FALLBACK_POOLS]
    : FALLBACK_POOLS.general;
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
  const commandDirective: Record<NonNullable<LoreCommand>, string> = {
    story:     'Tell a short fictional survival story set in Sector 13. Keep it dark and atmospheric.',
    wisdom:    'Give one piece of short, dark survival wisdom. One or two sentences maximum.',
    rumor:     'Create one dark, believable rumor from this world. Make it feel real and unsettling.',
    name:      'Give this survivor a dark nickname or survivor title. This will be remembered as their name.',
    lastwords: 'Deliver a chilling final radio transmission as if from a lost survivor. Make it feel authentic.',
    prison:    'Share a disturbing observation about the prison island. Keep it short and unsettling.',
    bunker:    'Describe something found or noticed in an old bunker. Make it atmospheric and foreboding.',
  };

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

  const nicknameBlock = memory.nickname
    ? `This survivor is known as: ${memory.nickname}`
    : '';

  const directive = command ? `Task: ${commandDirective[command]}` : '';

  const memoryLines = memory.messages.length > 0
    ? `Recent messages from ${memory.displayName}:\n${memory.messages.map(m => `- ${m}`).join('\n')}`
    : '';

  const parts = [
    systemBlock,
    nicknameBlock,
    directive,
    memoryLines,
    `${memory.displayName} says: ${userMessage}`,
    'Your reply as The Old Man:',
  ].filter(Boolean);

  return parts.join('\n\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function trimToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return cut > 0 ? text.slice(0, cut) : text.slice(0, max);
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

// ─── Memory helpers ───────────────────────────────────────────────────────────

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

    const userInput    = trimToLength(message.content, 500);
    const displayName  = message.member?.displayName ?? message.author.username;
    const memory       = getOrCreateMemory(userId, displayName);
    const command      = detectCommand(userInput);
    const prompt       = buildOldManPrompt(userInput, memory, command);
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
