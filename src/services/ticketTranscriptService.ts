import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Ticket } from '../types/index';

export interface TranscriptMessage {
  authorId:        string;
  authorTag:       string;
  authorIsBot:     boolean;
  authorIsSupport: boolean;
  content:         string;
  attachments:     { name: string; url: string; size: number }[];
  timestamp:       Date;
}

// Extended type for fields not yet in the Ticket interface (added in Task 6)
type TicketWithExtras = Ticket & { priority?: string; close_reason?: string };

const MAX_MESSAGES = 500;

export async function generateTranscript(
  ticket:    Ticket,
  messages:  TranscriptMessage[],
  guildName: string,
  dataDir:   string,
): Promise<string> {
  const relativePath = `transcripts/${ticket.guild_id}/${ticket.id}.html`;
  const absDir = join(dataDir, 'transcripts', ticket.guild_id);
  mkdirSync(absDir, { recursive: true });

  const capped = messages.slice(0, MAX_MESSAGES);
  const html   = buildHtml(ticket as TicketWithExtras, capped, guildName);
  writeFileSync(join(absDir, `${ticket.id}.html`), html, 'utf-8');
  return relativePath;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTs(ts: Date | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : ts;
  return d.toLocaleString('de-DE', { timeZone: 'UTC' });
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Niedrig', medium: 'Mittel', high: 'Hoch', urgent: 'Dringend',
};

function buildHtml(ticket: TicketWithExtras, messages: TranscriptMessage[], guildName: string): string {
  const openedAt   = ticket.created_at;
  const closedAt   = ticket.closed_at ?? Math.floor(Date.now() / 1000);
  const durationS  = closedAt - openedAt;
  const durStr     = durationS < 3600
    ? `${Math.floor(durationS / 60)} Min.`
    : durationS < 86400
      ? `${Math.floor(durationS / 3600)} Std.`
      : `${Math.floor(durationS / 86400)} Tage`;

  const participants = new Map<string, { tag: string; isBot: boolean; isSupport: boolean }>();
  for (const m of messages) {
    if (!participants.has(m.authorId)) {
      participants.set(m.authorId, { tag: m.authorTag, isBot: m.authorIsBot, isSupport: m.authorIsSupport });
    }
  }

  const participantsHtml = [...participants.entries()].map(([id, p]) => {
    const role = p.isBot ? 'Bot' : p.isSupport ? 'Support' : 'Nutzer';
    return `<li>${esc(p.tag)} <span style="color:#888">(${role}, ID: ${esc(id)})</span></li>`;
  }).join('');

  const messagesHtml = messages.map(m => {
    const bg = m.authorIsBot ? '#1a1a2e' : m.authorIsSupport ? '#162032' : '#1e2433';
    const nameColor = m.authorIsSupport ? '#43b581' : '#ccc';
    const attachsHtml = m.attachments.map(a =>
      `<a href="${esc(a.url)}" style="color:#5b8dd9;display:block;margin-top:4px">` +
      `&#128206; ${esc(a.name)} (${Math.round(a.size / 1024)} KB)</a>`
    ).join('');
    return `
    <div style="background:${bg};border-radius:6px;padding:10px 14px;margin-bottom:6px">
      <div style="display:flex;gap:10px;align-items:baseline">
        <span style="font-weight:600;color:${nameColor}">${esc(m.authorTag)}</span>
        <span style="font-size:.78rem;color:#555">${fmtTs(m.timestamp)}</span>
      </div>
      <div style="margin-top:4px;color:#ddd;white-space:pre-wrap">${esc(m.content)}</div>
      ${attachsHtml}
    </div>`;
  }).join('');

  const reasonHtml = ticket.close_reason
    ? `<div style="grid-column:1/-1"><div class="ml">Schlie&szlig;grund</div>` +
      `<div class="mv">${esc(ticket.close_reason)}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${ticket.id} &mdash; ${esc(guildName)}</title>
<style>
body{margin:0;padding:20px;background:#0f1117;color:#ccc;font-family:system-ui,sans-serif;line-height:1.5}
h1{color:#fff;border-bottom:1px solid #333;padding-bottom:12px}
.meta{background:#161b22;border-radius:8px;padding:16px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ml{color:#888;font-size:.8rem}.mv{color:#e6edf3;font-size:.9rem}
h2{color:#aaa;font-size:1rem;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.05em}
ul{padding-left:20px}a{color:#5b8dd9}
footer{margin-top:30px;padding-top:12px;border-top:1px solid #333;font-size:.75rem;color:#555;text-align:center}
</style>
</head>
<body>
<h1>Ticket #${ticket.id}</h1>
<div class="meta">
  <div><div class="ml">Server</div><div class="mv">${esc(guildName)}</div></div>
  <div><div class="ml">Kategorie</div><div class="mv">${esc(ticket.category)}</div></div>
  <div><div class="ml">Priorit&auml;t</div><div class="mv">${PRIORITY_LABEL[ticket.priority ?? 'medium'] ?? (ticket.priority ?? 'medium')}</div></div>
  <div><div class="ml">Status</div><div class="mv">Geschlossen</div></div>
  <div><div class="ml">Ersteller (ID)</div><div class="mv">${esc(ticket.opener_user_id)}</div></div>
  <div><div class="ml">Geschlossen von (ID)</div><div class="mv">${esc(ticket.closed_by ?? '&mdash;')}</div></div>
  <div><div class="ml">Ge&ouml;ffnet</div><div class="mv">${fmtTs(openedAt)}</div></div>
  <div><div class="ml">Geschlossen</div><div class="mv">${fmtTs(closedAt)}</div></div>
  <div><div class="ml">Laufzeit</div><div class="mv">${durStr}</div></div>
  <div><div class="ml">Nachrichten</div><div class="mv">${messages.length}</div></div>
  ${reasonHtml}
</div>
<h2>Teilnehmer</h2>
<ul>${participantsHtml}</ul>
<h2>Nachrichtenprotokoll (${messages.length})</h2>
${messagesHtml}
<footer>Generiert am ${fmtTs(new Date())} &mdash; ${esc(guildName)} Ticketsystem</footer>
</body>
</html>`;
}
