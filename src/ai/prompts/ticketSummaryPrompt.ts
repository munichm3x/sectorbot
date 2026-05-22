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
