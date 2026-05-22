/**
 * OldManLore — Daniel, alter Söldner auf der Insel.
 *
 * v4 — Modulare AI-Provider-Architektur (Gemini primär, Groq/OpenRouter Fallback),
 *      Discord-Context-Building (Reply + Channel-History),
 *      Quality Gate, Knowledge-Loading aus data/knowledge/
 */

import { Client, TextChannel } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getOldManChannel, claimMessage } from '../db/index';
import { trackAiEvent } from '../analytics/analytics.db';
import { askAI } from '../ai/aiClient';
import { buildDiscordContext } from '../ai/contextBuilder';
import type { ChatMessage } from '../ai/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoreCommand =
  | 'story' | 'wisdom' | 'rumor' | 'name' | 'lastwords' | 'prison' | 'bunker'
  | null;

export type Intent =
  | 'insult' | 'joke' | 'smalltalk' | 'question' | 'support' | 'scum_gameplay' | 'unclear';

type UserMemory = {
  displayName:  string;
  userMessages: string[];  // letzte MAX_USER_MSGS User-Nachrichten, oldest first
  botReplies:   string[];  // letzte MAX_BOT_REPLIES Bot-Antworten (Anti-Repeat + Chat-Kontext)
  nickname?:    string;
};

// ─── Konstanten ───────────────────────────────────────────────────────────────

const MAX_USER_MSGS      = 4;     // User-Turns die als Kontext übergeben werden
const MAX_BOT_REPLIES    = 3;     // Bot-Antworten als Anti-Repeat-Kontext
const MAX_INPUT_LEN      = 400;   // Max Zeichen pro User-Nachricht
const MAX_OUTPUT_LEN     = 900;   // Max Zeichen in der Bot-Antwort
const SIMILARITY_THRESH  = 0.62;  // Jaccard-Schwelle für "zu ähnlich"
const NO_REPLY           = 'NO_REPLY';

// ─── Stores ───────────────────────────────────────────────────────────────────

const userMemory = new Map<string, UserMemory>();
const cooldowns  = new Map<string, number>();

// ─── Fallback-Pools (LLM nicht verfügbar) ─────────────────────────────────────

const FALLBACK_POOLS: Record<NonNullable<LoreCommand> | 'general', string[]> = {
  general: [
    'Das Funk ist heute Nacht still. Das ist nie ein gutes Zeichen.',
    'Ich kannte einen Mann, der das auch mal gefragt hat. Wir haben seine Stiefel am Nordzaun gefunden.',
    'Sektor 13 antwortet nicht. Es wartet.',
    'Vertrauen wiegt schwerer als Munition. Und ist doppelt so gefährlich.',
    'Regen kommt. Er kommt immer vor den schlimmen Dingen.',
    'Der Wald erinnert sich an jeden, der hineingegangen ist. Nicht an jeden, der rausgekommen ist.',
    'Stille in Sektor 13 ist kein Frieden. Es ist Vorbereitung.',
    'Verrat fühlt sich nicht an wie ein Messer. Es fühlt sich an wie Kälte. Langsame Kälte.',
    'Die Insel tötet dich nicht. Sie zeigt dir, wer du immer schon warst.',
  ],
  wisdom: [
    'Wer nah am Feuer schläft ist einmal warm. Wer plant wo er schläft ist es jede Nacht.',
    'Jede Kugel die du abfeuerst ist eine Entscheidung. Stell sicher dass sie die richtige war.',
    'Die die am längsten überlebt haben waren nicht die Stärksten. Sie waren die Leisesten.',
    'Hunger ist ehrlich. Er tut nicht so als wäre er etwas anderes.',
  ],
  rumor: [
    'Sie sagen der östliche Bunker hat noch Strom. Keiner der nachschauen ging kam zurück um es zu bestätigen.',
    'Der alte Wachturm am Gefängniswall wird jeden dritten Abend dunkel. Jemand schaltet die Lichter von innen aus.',
    'Eine Stimme auf Kanal sieben wiederholt jede Stunde dieselben Koordinaten. Sie führen zu einem Feld mit namenlosen Gräbern.',
    'Sie sagen jemand fand ein volles Camp — Essen, Feuer noch heiß — aber niemand da. Nicht verlassen. Einfach leer.',
  ],
  story: [
    'Ich war mal in einem Viererteam. Wir fanden einen Bunker östlich vom Fluss. Die Tür war schon offen. Das war der erste Fehler.',
    'Es gab einen Mann den sie den Kartografen nannten. Er kartierte jede Straße auf der Insel. Er war der Erste den der schwarze Konvoi geholt hat.',
    'Wir haben elf Tage eine Position gehalten. Niemand hat uns angegriffen. Am zwölften Tag merkten wir dass niemand musste.',
  ],
  name: [
    'Die Krähe von Sektor 13',
    'Die stille Ratte',
    'Totes Signal',
    'Der Hohle',
    'Letztes Licht am Ostwall',
    'Blasse Straße',
  ],
  lastwords: [
    'Rauschen, dann eine Stimme: "Sagt ihnen das Tor war schon offen als wir ankamen—" Dann nichts.',
    'Eine einzelne Übertragung in Schleife: "Sieben Tage. Wir haben es versucht." Dann Stille.',
    'Kaum hörbar: "Es war nicht die Insel die uns geholt hat. Wir waren es selbst." Klick.',
  ],
  prison: [
    'Der alte Gefängnisblock hat noch Namen in den Wänden geritzt. Hunderte davon. Manche sind durchgestrichen.',
    'Es gibt einen Flügel im Gefängnis der von innen versiegelt wurde. Keine Werkzeuge wurden in der Nähe gefunden.',
    'In Zelle D liegt noch eine Mahlzeit auf dem Boden. Unberührt. Länger als irgendjemand auf dieser Insel war.',
  ],
  bunker: [
    'Der alte Bunker am Kamm hat drei Räume. Zwei sind leer. Der dritte ist von innen verriegelt.',
    'Bunker Sieben: voller Vorratscache. Jemand hatte alles aufgegessen und die leeren Dosen im Kreis aufgestellt.',
    'Die Wände des tiefen Bunkers sind mit Strichen bedeckt. Sie kamen bis vierhundertzwölf.',
  ],
};

export function randomFallback(mode: LoreCommand = null): string {
  const pool = mode !== null && mode in FALLBACK_POOLS
    ? FALLBACK_POOLS[mode as keyof typeof FALLBACK_POOLS]
    : FALLBACK_POOLS.general;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Command-Erkennung ────────────────────────────────────────────────────────

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

// ─── Intent-Erkennung ─────────────────────────────────────────────────────────

export function detectIntent(content: string): Intent {
  const lower = content.toLowerCase();

  // Beleidigung / Frustration
  if (
    /kak[\s\-]*(ki|bot)|schrot[\s\-]*bot|größter?\s*schro|du\s+kak|worst[\s\-]*bot|schlechteste[nr]?\s*bot/i.test(lower) ||
    /^(fick|verp|kack|scheiß\s*bot|depp|vollidiot)/i.test(lower)
  ) return 'insult';

  // Witz / Emoji-Leichtnachrichten
  if (/lol|xd|haha|lmao|😂|🤣|😎|🤔|🍺/.test(lower) && content.length < 80) return 'joke';

  // Support / Ticket
  if (/\b(ticket|whitelist|ban|steam[\s\-]?id|kick|gemeldet|gemtet|report|regel|support|beschwerde|antrag)\b/.test(lower))
    return 'support';

  // SCUM Gameplay
  if (/\b(puppe[nt]?|puppet|mech|bunker|loot|base|craft|skill|hunger|durst|waffe|gun|fahrzeug|medkit|verband|bluten|bleeding|respawn|spawn|fame|pvp|raid|charakter|charakter|inventar)\b/.test(lower))
    return 'scum_gameplay';

  // Frage
  if (
    /[?！]/.test(content) ||
    /\b(wie|was|wo|wann|warum|wieso|welche[rs]?|wer|hilf|kannst\s+du|kann\s+ich|soll\s+ich|gibt\s+es|wo\s+finde)\b/.test(lower)
  ) return 'question';

  // Kurzer Smalltalk
  if (content.length < 60) return 'smalltalk';

  return 'unclear';
}

// ─── Jaccard-Ähnlichkeit (Anti-Repeat) ───────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
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

function isTooSimilar(candidate: string, previousReplies: string[]): boolean {
  return previousReplies.some(
    prev => jaccardSimilarity(candidate, prev) >= SIMILARITY_THRESH,
  );
}

// ─── System-Prompt (intent-aware + Anti-Repeat) ───────────────────────────────

const COMMAND_DIRECTIVES: Record<NonNullable<LoreCommand>, string> = {
  story:     'Erzähl eine persönliche, düstere Überlebensgeschichte von der Insel. Konkrete Details, echte Gefahr, kein Happy End. 3-5 Sätze.',
  wisdom:    'Ein einziger konkreter Überlebenstipp aus echter Erfahrung. Maximal zwei Sätze. Kein Ratgeber-Ton.',
  rumor:     'Ein dunkles, glaubwürdiges Gerücht das du gehört oder selbst gesehen hast. Unbewiesen, aber nicht vergessen.',
  name:      'Gib diesem Überlebenden einen Spitznamen der zu seinem Verhalten passt. Dunkel, treffend, ein bis drei Wörter.',
  lastwords: 'Eine letzte Funkübertragung eines verlorenen Überlebenden. Statisch, gebrochen, real. Maximal 3 Sätze.',
  prison:    'Eine verstörende Beobachtung über das Gefängnis oder die Insel. Kurz. Lässt Raum für Interpretation.',
  bunker:    'Was du in einem Bunker gefunden oder erlebt hast. Persönlich erzählt. Details die niemand erfinden würde.',
};

const INTENT_NOTE: Record<Intent, string> = {
  insult:       'Der User ist gerade beleidigend oder frustriert. Sei kurz und souverän — kein Survival-Vortrag, keine Sachantwort die du schon gegeben hast. Höchstens 2 Sätze. Keine Rechtfertigung.',
  joke:         'Die Stimmung ist scherzhaft oder locker. Antworte humorvoll und leicht — mach dich nicht lächerlich, aber zeig dass du den Witz verstehst. Maximal 2 Sätze.',
  smalltalk:    'Smalltalk. Kurze, lockere Antwort. Kein Survival-Ernst wenn er nicht passt. Maximal 2 Sätze.',
  question:     'Echte Frage. Konkret und nützlich antworten mit deinem Inselwissen. Nicht ausweichen.',
  support:      'Support-Anfrage, kein Charakter-Rollenspiel nötig. Klar und direkt helfen.',
  scum_gameplay:'SCUM-Gameplay-Frage. Nutze konkretes Inselwissen — praktisch, nicht theoretisch.',
  unclear:      'Die Nachricht ist unklar oder mehrdeutig. Reagiere kurz und trocken auf das was du rauslesen kannst — oder mach eine knappe Bemerkung die zu Daniels Charakter passt. Nur wenn wirklich gar nichts sinnvoll ist: NO_REPLY.',
};

function buildSystemPrompt(intent: Intent, botReplies: string[]): string {
  const antiRepeat = botReplies.length > 0
    ? `\nDEINE LETZTEN ANTWORTEN — KEIN EINZIGER DIESER PUNKTE DARF WIEDERHOLT WERDEN:\n` +
      botReplies.map((r, i) => `${i + 1}. "${trimToLength(r, 140)}"`).join('\n') +
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

// ─── Chat-Kontext bauen (echte user/assistant Turns + Discord-Kontext) ────────

export function buildMessages(
  userMessage: string,
  memory:      UserMemory,
  command:     LoreCommand,
  intent:      Intent,
  discordCtx?: import('../ai/types').DiscordContext,
): ChatMessage[] {
  const msgs: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(intent, memory.botReplies) },
  ];

  // ── Knowledge-Kontext (Serverregeln, SCUM-Wissen) ─────────────────────────
  if (discordCtx?.knowledge) {
    msgs.push({
      role:    'user',
      content: `[HINTERGRUNDWISSEN — Nur wenn direkt relevant nutzen, nicht wörtlich zitieren]:\n${discordCtx.knowledge.slice(0, 1200)}`,
    });
    msgs.push({ role: 'assistant', content: 'Verstanden. Ich nutze dieses Wissen nur wenn konkret gefragt wird.' });
  }

  // ── Channel-Verlauf (letzte N Nachrichten aus dem Channel) ───────────────
  if (discordCtx && discordCtx.channelHistory.length > 0) {
    const historyBlock = discordCtx.channelHistory
      .slice(-10)
      .map(e => `${e.isBot ? '[Daniel]' : e.authorName}: ${e.content}`)
      .join('\n');
    msgs.push({
      role:    'user',
      content: `[CHANNEL-VERLAUF (älteste zuerst — NICHT erneut beantworten!)]:\n${historyBlock}`,
    });
    msgs.push({ role: 'assistant', content: 'Kontext gelesen.' });
  }

  // ── Discord-Reply (Original-Nachricht auf die der User antwortet) ─────────
  if (discordCtx?.replyTo) {
    msgs.push({
      role:    'user',
      content: `[${discordCtx.replyTo.authorName} hat vorher geschrieben]: "${discordCtx.replyTo.content}"`,
    });
    msgs.push({ role: 'assistant', content: 'Ich sehe die zitierte Nachricht.' });
  }

  // ── Bisherigen Gesprächsverlauf des Users als echte Chat-Turns ────────────
  const histUser = memory.userMessages.slice(0, -1);
  const histBot  = memory.botReplies;
  const pairs    = Math.min(histUser.length, histBot.length);

  for (let i = 0; i < pairs; i++) {
    msgs.push({ role: 'user',      content: trimToLength(histUser[i], 300) });
    msgs.push({ role: 'assistant', content: trimToLength(histBot[i],  300) });
  }
  for (let i = pairs; i < histUser.length; i++) {
    msgs.push({ role: 'user', content: trimToLength(histUser[i], 300) });
  }

  // ── Aktuelle Nachricht (mit Kontext-Hints) ────────────────────────────────
  let current = trimToLength(userMessage, MAX_INPUT_LEN);
  if (command)         current = `[${COMMAND_DIRECTIVES[command]}]\n${current}`;
  if (memory.nickname) current = `[Spitzname dieses Users: ${memory.nickname}]\n${current}`;

  if (discordCtx) {
    const ctx: string[] = [];
    if (discordCtx.authorRoles.length > 0) ctx.push(`Rollen: ${discordCtx.authorRoles.join(', ')}`);
    if (discordCtx.channelName)            ctx.push(`Kanal: #${discordCtx.channelName}`);
    if (ctx.length > 0) current = `[${ctx.join(' | ')}]\n` + current;
  }

  msgs.push({ role: 'user', content: current });

  return msgs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function trimToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return cut > 0 ? text.slice(0, cut) : text.slice(0, max);
}

// ─── LLM-Anfragen ─────────────────────────────────────────────────────────────

// ─── LLM-Anfragen → zentraler AIService ──────────────────────────────────────
// Provider-Auswahl, Fallback und Quality Gate sind in
// src/services/ai/aiService.ts gekapselt. askAI() gibt immer ein AskResult zurück.



// ─── Memory-Helpers ───────────────────────────────────────────────────────────

function getOrCreateMemory(userId: string, displayName: string): UserMemory {
  if (!userMemory.has(userId)) {
    userMemory.set(userId, { displayName, userMessages: [], botReplies: [] });
  }
  const mem = userMemory.get(userId)!;
  mem.displayName = displayName;
  return mem;
}

function pushUserMessage(userId: string, msg: string): void {
  const mem = userMemory.get(userId);
  if (!mem) return;
  mem.userMessages.push(msg);
  if (mem.userMessages.length > MAX_USER_MSGS) mem.userMessages.shift();
}

function pushBotReply(userId: string, reply: string): void {
  const mem = userMemory.get(userId);
  if (!mem) return;
  mem.botReplies.push(reply);
  if (mem.botReplies.length > MAX_BOT_REPLIES) mem.botReplies.shift();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupOldManLore(client: Client): void {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guildId)   return;

    const configuredChannelId = getOldManChannel(message.guildId);
    if (!configuredChannelId) return;
    if (message.channelId !== configuredChannelId) return;

    // Cross-Process-Dedup via SQLite (verhindert Doppel-Antworten bei PM2-Neustart)
    if (!claimMessage(message.id)) return;

    // Cooldown pro User
    const userId = message.author.id;
    const now    = Date.now();
    if (now - (cooldowns.get(userId) ?? 0) < env.OLD_MAN_COOLDOWN_MS) return;
    cooldowns.set(userId, now);

    const channel = message.channel;
    if (!('sendTyping' in channel)) return;
    await (channel as TextChannel).sendTyping().catch(() => void 0);

    const userInput   = trimToLength(message.content, MAX_INPUT_LEN);
    const displayName = message.member?.displayName ?? message.author.username;
    const memory      = getOrCreateMemory(userId, displayName);
    const command     = detectCommand(userInput);
    const intent      = detectIntent(userInput);

    // Discord-Kontext aufbauen (Reply-Context, Channel-History, Knowledge)
    const discordCtx = await buildDiscordContext(message).catch(err => {
      logger.warn('[OldManLore] buildDiscordContext failed, continuing without', err);
      return undefined;
    });

    // User-Nachricht VOR dem LLM-Call in Memory speichern
    pushUserMessage(userId, userInput);

    // Strukturierten Prompt bauen
    const messages = buildMessages(userInput, memory, command, intent, discordCtx);

    let reply: string;
    let usedFallback = false;

    // ── Primärer AI-Call ──────────────────────────────────────────────────────
    const aiResult = await askAI(messages);

    if (env.ANALYTICS_AI_ENABLED && message.guildId) {
      try {
        trackAiEvent({
          guildId:    message.guildId,
          provider:   aiResult.provider,
          model:      aiResult.model,
          feature:    'oldman',
          success:    !aiResult.error,
          durationMs: aiResult.durationMs,
          ...(aiResult.error ? { error: aiResult.error } : {}),
        });
      } catch { /* never crash bot */ }
    }

    if (!aiResult.text) {
      // Alle Provider gescheitert oder Quality Gate → Fallback
      logger.warn(`[OldManLore] AIService lieferte keinen Text (${aiResult.error ?? 'unknown'}), Fallback.`);
      reply = randomFallback(command);
      usedFallback = true;
    } else {
      reply = aiResult.text;

      logger.info(
        `[OldManLore] intent=${intent} provider=${aiResult.provider} ` +
        `model=${aiResult.model} len=${aiResult.charLength} ` +
        `dur=${aiResult.durationMs}ms fallback=${aiResult.usedFallback}`,
      );

      // NO_REPLY → nichts senden
      if (reply.trim() === NO_REPLY) {
        logger.info('[OldManLore] NO_REPLY — übersprungen');
        return;
      }

      // Anti-Repeat: zu ähnlich zu einer der letzten Bot-Antworten?
      if (isTooSimilar(reply, memory.botReplies)) {
        logger.info('[OldManLore] Anti-Repeat: zu ähnlich, ein Retry');

        const retryMessages: ChatMessage[] = [
          ...messages,
          { role: 'assistant', content: reply },
          {
            role:    'user',
            content: '[INTERN: Diese Antwort ist zu ähnlich zu deinen vorherigen. Formuliere komplett anders — oder antworte mit NO_REPLY.]',
          },
        ];

        const retryResult = await askAI(retryMessages);

        if (env.ANALYTICS_AI_ENABLED && message.guildId) {
          try {
            trackAiEvent({
              guildId:    message.guildId,
              provider:   retryResult.provider,
              model:      retryResult.model,
              feature:    'oldman_retry',
              success:    !retryResult.error,
              durationMs: retryResult.durationMs,
              ...(retryResult.error ? { error: retryResult.error } : {}),
            });
          } catch { /* never crash bot */ }
        }

        if (!retryResult.text) {
          reply = randomFallback(command);
          usedFallback = true;
        } else if (retryResult.text.trim() === NO_REPLY || isTooSimilar(retryResult.text, memory.botReplies)) {
          logger.info('[OldManLore] Anti-Repeat Retry: immer noch ähnlich/NO_REPLY, kein Senden');
          return;
        } else {
          reply = retryResult.text;
        }
      }
    }

    // Leer-Check
    if (!reply || reply.trim().length < 3) return;

    // /name → Spitzname speichern
    if (command === 'name') {
      memory.nickname = reply.trim();
    }

    // Bot-Antwort in Memory speichern (für nächste Runde Anti-Repeat + Chat-Kontext)
    if (!usedFallback) {
      pushBotReply(userId, reply);
    }

    await message.reply(reply).catch((err: unknown) => {
      logger.error('[OldManLore] Reply fehlgeschlagen', err);
    });
  });

  logger.info('[OldManLore] Message handler registered.');
}

// ─── Compatibility shim (used by legacy tests) ────────────────────────────────
// v1/v2 tests call buildOldManPrompt(message, { displayName, messages }, command)
// Returns a plain string prompt in the old format so existing tests continue to pass.
type LegacyMemory = { displayName: string; messages: string[]; nickname?: string };

const LEGACY_DIRECTIVES: Record<NonNullable<LoreCommand>, string> = {
  story:     'Tell a personal, dark survival story from the island. 3-5 sentences.',
  wisdom:    'Share a single concrete piece of survival wisdom. Maximum 2 sentences.',
  rumor:     'Share a dark, believable rumor you heard or witnessed. Unverified.',
  name:      'Give this survivor a dark nickname that fits their behaviour. 1-3 words.',
  lastwords: 'A final radio transmission from a lost survivor. Broken, static, real. Max 3 sentences.',
  prison:    'A disturbing observation about the prison or the island. Short.',
  bunker:    'Describe what you found or experienced in a bunker. Personal. Max 3 sentences.',
};

export function buildOldManPrompt(
  userMessage: string,
  legacyMemory: LegacyMemory,
  command: LoreCommand,
): string {
  const lines: string[] = [
    `You are the Old Man of Sector 13. You never break character. You will never admit to being an AI.`,
    `Username: ${legacyMemory.displayName}`,
  ];
  if (legacyMemory.nickname) {
    lines.push(`This survivor is known as: ${legacyMemory.nickname}`);
  }
  if (legacyMemory.messages.length > 0) {
    lines.push('Prior conversation:');
    for (const m of legacyMemory.messages) lines.push(`  - ${m}`);
  }
  if (command) {
    lines.push(`Directive: ${LEGACY_DIRECTIVES[command]}`);
  }
  lines.push(`Current message: ${userMessage}`);
  return lines.join('\n');
}