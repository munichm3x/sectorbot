import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { Ticket } from '../types';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface MessageEntry {
  authorName:      string;
  authorId:        string;
  isBot:           boolean;
  content:         string;
  attachmentCount: number;
  timestamp:       Date;
}

export interface SummaryResult {
  text:   string;
  usedAI: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const MAX_MESSAGES_FOR_AI = 60;
const MSG_TRUNCATE_LEN    = 250;
const TIMEOUT_MS          = 12_000;

// ─── Main export ───────────────────────────────────────────────────────────────

export async function generateTicketSummary(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): Promise<SummaryResult> {
  if (env.GROQ_API_KEY) {
    try {
      const text = await groqSummary(ticket, messages, categoryLabel);
      return { text, usedAI: true };
    } catch (err) {
      logger.warn('[ticketSummary] Groq fehlgeschlagen — Fallback wird verwendet:', err);
    }
  }
  return { text: fallbackSummary(messages, categoryLabel), usedAI: false };
}

// ─── Groq AI summary ───────────────────────────────────────────────────────────

async function groqSummary(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): Promise<string> {
  // Build conversation block — skip bot-only embed messages (empty content)
  const relevant = messages
    .filter(m => m.content.trim().length > 0)
    .slice(0, MAX_MESSAGES_FOR_AI);

  const conversation = relevant.map(m => {
    const who     = m.isBot ? '[BOT]' : `[${m.authorName}]`;
    const content = m.content.trim().slice(0, MSG_TRUNCATE_LEN);
    const attach  = m.attachmentCount > 0 ? ` [📎 ${m.attachmentCount} Anhang]` : '';
    return `${who}: ${content}${attach}`;
  }).join('\n');

  if (!conversation) {
    throw new Error('Kein auswertbarer Inhalt für Groq');
  }

  const systemPrompt =
    'Du bist ein internes Support-KI-System für den SCUM Survival Server "SECTOR 13".\n' +
    'Erstelle eine kompakte, strukturierte Zusammenfassung eines abgeschlossenen Support-Tickets für das Admin-Team.\n' +
    'Wichtig: Erfinde NIEMALS Informationen. Nutze ausschließlich Daten aus dem Ticketverlauf.\n' +
    'Wenn etwas nicht erkennbar ist, schreibe "Nicht erkennbar" — niemals spekulieren.\n' +
    'Antworte ausschließlich auf Deutsch. Kein Einleitungstext. Keine Grußformeln.\n\n' +
    'Verwende exakt dieses Format:\n' +
    'Kurzbeschreibung: [1-2 Sätze zum Anliegen]\n' +
    'Kernproblem: [konkretes Problem oder "Nicht klar erkennbar"]\n' +
    'Wichtige Details:\n- [max. 3 Stichpunkte — nur wenn vorhanden, sonst weglassen]\n' +
    'Ergebnis: [getroffene Entscheidung/Lösung oder "Kein klares Ergebnis erkennbar"]\n\n' +
    'Maximal 280 Wörter.';

  const userPrompt =
    `Ticket-ID: #${ticket?.id ?? '?'}\n` +
    `Kategorie: ${categoryLabel}\n\n` +
    `Verlauf:\n${conversation}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages:    [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:  550,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq: leere Antwort');
  return text;
}

// ─── Fallback summary (no AI) ──────────────────────────────────────────────────

function fallbackSummary(messages: MessageEntry[], categoryLabel: string): string {
  const userMsgs    = messages.filter(m => !m.isBot && m.content.trim().length > 0);
  const attachTotal = messages.reduce((n, m) => n + m.attachmentCount, 0);
  const hasLinks    = messages.some(m => /https?:\/\//.test(m.content));

  // Edge cases
  if (userMsgs.length === 0) {
    return (
      'Kurzbeschreibung: Das Ticket enthielt keine Nachrichten vom Nutzer.\n' +
      'Kernproblem: Nicht erkennbar.\n' +
      'Ergebnis: Keine verwertbaren Informationen vorhanden.'
    );
  }

  const firstMsg  = userMsgs[0]!.content.trim().slice(0, 300);
  const shortMsg  = userMsgs.length === 1 && firstMsg.length < 15;

  if (shortMsg) {
    return (
      'Kurzbeschreibung: Der Nutzer hat keine ausreichende Problembeschreibung hinterlassen.\n' +
      'Kernproblem: Nicht erkennbar.\n' +
      'Ergebnis: Keine verwertbaren Informationen vorhanden.'
    );
  }

  // Detect SCUM-specific keywords in all user messages
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

  if (hints.length > 0) {
    lines.push(`Wichtige Details:\n${hints.slice(0, 5).join('\n')}`);
  }

  lines.push('Ergebnis: Kein klares Ergebnis erkennbar — manuelle Prüfung empfohlen.');
  return lines.join('\n');
}
