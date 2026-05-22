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
