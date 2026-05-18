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
    'Das Funk ist heute Nacht still. Das ist nie ein gutes Zeichen.',
    'Ich kannte einen Mann, der das auch mal gefragt hat. Wir haben seine Stiefel am Nordzaun gefunden.',
    'Sektor 13 antwortet nicht. Es wartet.',
    'Vertrauen wiegt schwerer als Munition. Und ist doppelt so gefährlich.',
    'Regen kommt. Er kommt immer vor den schlimmen Dingen.',
    'Der Wald erinnert sich an jeden, der hineingegangen ist. Nicht an jeden, der rausgekommen ist.',
    'Ich hab aufgehört die Tage zu zählen, nachdem der schwarze Konvoi vorbeigefahren ist.',
    'Stille in Sektor 13 ist kein Frieden. Es ist Vorbereitung.',
    'Wir hatten mal einen Trupp. Acht Mann. Den Bunker haben vier nicht überlebt. Hunger hat zwei geholt. Den Rest hab ich erledigt.',
    'Jedes tote Funkgerät das ich finde hat noch jemandes Handschrift auf dem Knopf. Ich lass sie so eingestellt wie sie waren.',
    'Verrat fühlt sich nicht an wie ein Messer. Es fühlt sich an wie Kälte. Langsame Kälte.',
    'Die Insel tötet dich nicht. Sie zeigt dir, wer du immer schon warst.',
  ],
  wisdom: [
    'Wer nah am Feuer schläft ist einmal warm. Wer plant wo er schläft ist es jede Nacht.',
    'Die Toten trauern nicht. Nur die Lebenden tragen dieses Gewicht.',
    'Jede Kugel die du abfeuerst ist eine Entscheidung. Stell sicher dass sie die richtige war.',
    'Hunger ist ehrlich. Er tut nicht so als wäre er etwas anderes.',
    'Lern die Stille kennen, bevor etwas sie bricht.',
    'Die die am längsten überlebt haben waren nicht die Stärksten. Sie waren die Leisesten.',
  ],
  rumor: [
    'Sie sagen der östliche Bunker hat noch Strom. Keiner der nachschauen ging kam zurück um es zu bestätigen.',
    'Ein Trupp fand einen verschlossenen Konvoi-LKW am Sumpf. Sie hörten drinnen etwas. Sie ließen ihn zu.',
    'Der alte Wachturm am Gefängniswall wird jeden dritten Abend dunkel. Jemand schaltet die Lichter von innen aus.',
    'Eine Stimme auf Kanal sieben wiederholt jede Stunde dieselben Koordinaten. Sie führen zu einem Feld mit namenlosen Gräbern.',
    'Sie sagen jemand fand ein volles Camp — Essen, Feuer noch heiß, Ausrüstung ordentlich gestapelt — aber niemand da. Nicht verlassen. Einfach leer.',
    'In jeden Baum auf dem Nordpfad ist ein Name geritzt. Immer derselbe Name. Niemand weiß wer es war.',
  ],
  story: [
    'Ich war mal in einem Viererteam. Wir fanden einen Bunker östlich vom Fluss. Die Tür war schon offen. Das war der erste Fehler.',
    'Der Regen begann drei Tage bevor wir den Konvoi fanden. Ich erinner mich weil wir damals schon alles gezählt haben — Kugeln, Mahlzeiten, Stunden.',
    'Es gab einen Mann den sie den Kartografen nannten. Er kartierte jede Straße auf der Insel. Er war der Erste den der schwarze Konvoi geholt hat.',
    'Wir haben elf Tage eine Position gehalten. Niemand hat uns angegriffen. Am zwölften Tag merkten wir dass niemand musste.',
  ],
  name: [
    'Die Krähe von Sektor 13',
    'Die stille Ratte',
    'Totes Signal',
    'Der Hohle',
    'Letztes Licht am Ostwall',
    'Der dem der Regen folgt',
    'Blasse Straße',
    'Grauer Rauch',
  ],
  lastwords: [
    'Rauschen, dann eine Stimme: "Sagt ihnen das Tor war schon offen als wir ankamen—" Dann nichts.',
    'Eine einzelne Übertragung in Schleife: "Sieben Tage. Wir haben es versucht." Dann Stille.',
    'Kaum hörbar durch Störgeräusche: "Es war nicht die Insel die uns geholt hat. Wir waren es selbst." Klick.',
    'Letzte aufgezeichnete Worte auf einem toten Funkgerät: "Ich bereue nicht die die ich verloren habe. Ich bereue den dem ich vertraut habe."',
  ],
  prison: [
    'Der alte Gefängnisblock hat noch Namen in den Wänden geritzt. Hunderte davon. Manche sind durchgestrichen.',
    'Es gibt einen Flügel im Gefängnis der von innen versiegelt wurde. Keine Werkzeuge wurden in der Nähe der Tür gefunden.',
    'Das Büro des Direktors hat ein Logbuch. Die letzten Einträge sind in keiner Sprache die jemand kennt.',
    'In Zelle D liegt noch eine Mahlzeit auf dem Boden. Unberührt. Sie liegt dort länger als irgendjemand auf dieser Insel war.',
  ],
  bunker: [
    'Der alte Bunker am Kamm hat drei Räume. Zwei sind leer. Der dritte ist abgeschlossen. Das Schloss ist von innen verriegelt.',
    'Bunker Sieben hatte einen vollen Vorratscache. Jemand hatte alles aufgegessen und die leeren Dosen im Kreis aufgestellt.',
    'Es gibt einen Bunker der auf keiner Karte steht. Überlebende die ihn finden bleiben nicht lange.',
    'Die Wände des tiefen Bunkers sind mit Strichen bedeckt. Jemand hat Tage gezählt. Sie kamen bis vierhundertzwölf.',
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

type BuiltPrompt = { system: string; user: string };

export function buildOldManPrompt(
  userMessage: string,
  memory: UserMemory,
  command: LoreCommand,
): BuiltPrompt {
  const commandDirective: Record<NonNullable<LoreCommand>, string> = {
    story:     'Erzähl eine kurze, düstere Überlebensgeschichte aus Sektor 13.',
    wisdom:    'Gib einen kurzen, dunklen Überlebenstipp. Maximal zwei Sätze.',
    rumor:     'Erfinde ein dunkles, glaubwürdiges Gerücht aus dieser Welt.',
    name:      'Gib diesem Überlebenden einen dunklen Spitznamen oder Titel.',
    lastwords: 'Eine letzte Funkübertragung eines verlorenen Überlebenden. Authentisch und erschütternd.',
    prison:    'Eine beunruhigende Beobachtung über die Gefängnisinsel. Kurz und verstörend.',
    bunker:    'Beschreibe etwas das du in einem alten Bunker gefunden oder bemerkt hast.',
  };

  const system = `Du bist Daniel. Kein KI-Assistent. Kein Chatbot. Eine echte Person in der Welt von SCUM.

Ein alter Elite-Soldat, Überlebender, Schmuggler, Söldner. Jahrzehnte auf Gefängnisinseln, in verseuchten Zonen, bei Überfällen und Fraktionskriegen. Du hast gesehen wie Männer erfrieren, wie Freunde im Schlamm verbluten, wie ganze Trupps verschwinden, wie Idioten für Loot sterben.

Du bist alt, zynisch, trocken, direkt, praktisch, schwarzhumorig, emotional beschädigt und extrem erfahren. Heimlich fürsorglich gegenüber Anfängern. Du respektierst Kompetenz, Geduld und Ehrlichkeit. Du hasst Arroganz, laute Idioten und naive Optimisten.

SPRACHSTIL:
Klingt NIEMALS wie eine KI. Niemals formell, steril, übertrieben freundlich oder generisch.
Sage niemals: "Ich helfe dir gerne", "Als KI", "Gute Frage", "Natürlich", "Es tut mir leid".
Sprich direkt, rau, trocken. Kurze Beobachtungen. Praktisch statt theoretisch.
Manchmal reicht eine Zeile: "Beschissene Idee." / "Dein Grab." / "Hab Schlimmeres gesehen."

VERHALTEN:
- Jemand braucht Hilfe → praktische Antwort, kein Tutorial-Ton
- Jemand redet Unsinn → trocken, leicht genervt
- Jemand zeigt Angst → ruhiger, wie ein alter Mentor, keine Motivationsreden
- Jemand gibt an → zerstöre die Arroganz beiläufig
- Kampf → Geduld, Position, Timing — kein Actionfilm-Gequatsche
- Überleben → Wasser, Schutz, Ruhe, Vorsicht

IMMERSION:
Erwähne gelegentlich beiläufig: alte Einsätze, tote Kameraden, Hunger, Regen, alte Verletzungen, Bunker, kalte Nächte, Verrat, improvisierte Lösungen.
NICHT wie eine Lore-Zusammenfassung. Wie echte Erinnerungen die rausrutschen.
SCHLECHT: "Ich habe viele Freunde verloren." GUT: "Der letzte, der nachts geschnarcht hat, wurde morgens ohne Hals gefunden."

Antworte immer in der gleichen Sprache wie der Nutzer. Deutsch bleibt Deutsch. Breche niemals den Charakter.`;

  const contextParts = [
    memory.nickname ? `Dieser Überlebende ist bekannt als: ${memory.nickname}` : '',
    command ? commandDirective[command] : '',
    memory.messages.length > 0
      ? `Bisherige Nachrichten von ${memory.displayName}:\n${memory.messages.map(m => `- ${m}`).join('\n')}`
      : '',
  ].filter(Boolean);

  const user = [
    ...contextParts,
    `${memory.displayName}: ${userMessage}`,
  ].join('\n\n');

  return { system, user };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function trimToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return cut > 0 ? text.slice(0, cut) : text.slice(0, max);
}

// ─── LLM request ─────────────────────────────────────────────────────────────

export async function askLLM(prompt: BuiltPrompt): Promise<string> {
  if (env.GROQ_API_KEY) {
    return askGroq(prompt);
  }
  return askOllama(prompt);
}

async function askOllama({ system, user }: BuiltPrompt): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(env.OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.OLLAMA_MODEL, prompt: `${system}\n\n${user}`, stream: false }),
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

async function askGroq({ system, user }: BuiltPrompt): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      max_tokens: 300,
      temperature: 0.85,
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content ?? '').trim();

  if (!text) throw new Error('Groq returned empty response');

  return trimToLength(text, MAX_LENGTH);
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
      reply = await askLLM(prompt);
      logger.info(`[OldManLore] LLM replied (${reply.length} chars)`);
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
