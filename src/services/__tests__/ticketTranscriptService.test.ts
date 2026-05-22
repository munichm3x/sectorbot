import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { generateTranscript, type TranscriptMessage } from '../ticketTranscriptService';
import type { Ticket } from '../../types/index';

const TMP = join(process.cwd(), 'tmp-transcript-test-' + Date.now());

const TICKET = {
  id: 42,
  guild_id: 'g1',
  channel_id: 'c1',
  opener_user_id: 'u1',
  category: 'ban',
  status: 'closed',
  claimed_by: 'u2',
  created_at: 1700000000,
  closed_at:  1700003600,
  closed_by:  'u2',
  close_reason: 'Anfrage bearbeitet',
  priority: 'high',
} as unknown as Ticket;

const MESSAGES: TranscriptMessage[] = [
  {
    authorId: 'u1', authorTag: 'Max#0001', authorIsBot: false, authorIsSupport: false,
    content: 'Ich wurde gebannt', attachments: [],
    timestamp: new Date(1700000100 * 1000),
  },
  {
    authorId: 'u2', authorTag: 'Support#9999', authorIsBot: false, authorIsSupport: true,
    content: 'Wir prüfen das',
    attachments: [{ name: 'beweis.png', url: 'https://cdn.example.com/beweis.png', size: 12345 }],
    timestamp: new Date(1700001000 * 1000),
  },
];

describe('ticketTranscriptService', () => {
  beforeEach(() => { mkdirSync(TMP, { recursive: true }); });
  afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

  it('returns relative path and creates the file', async () => {
    const path = await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    expect(path).toBe('transcripts/g1/42.html');
    expect(existsSync(join(TMP, 'transcripts', 'g1', '42.html'))).toBe(true);
  });

  it('HTML contains ticket metadata', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('42');
    expect(html).toContain('ban');
    expect(html).toContain('Anfrage bearbeitet');
    expect(html).toContain('Hoch');
  });

  it('HTML contains message content and author tags', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('Ich wurde gebannt');
    expect(html).toContain('Wir prüfen das');
    expect(html).toContain('Max#0001');
    expect(html).toContain('Support#9999');
  });

  it('HTML contains attachment link', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).toContain('beweis.png');
  });

  it('HTML has no external stylesheet or script src', async () => {
    await generateTranscript(TICKET, MESSAGES, 'Test Server', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).not.toMatch(/<link[^>]+href="https?:/i);
    expect(html).not.toMatch(/<script[^>]+src="https?:/i);
  });

  it('creates nested subdirectories automatically', async () => {
    const nested = join(TMP, 'deep', 'nested');
    await generateTranscript(TICKET, MESSAGES, 'Test', nested);
    expect(existsSync(join(nested, 'transcripts', 'g1', '42.html'))).toBe(true);
  });

  it('truncates to max 500 messages', async () => {
    const many: TranscriptMessage[] = Array.from({ length: 600 }, (_, i) => ({
      authorId: 'u1', authorTag: 'User#0001', authorIsBot: false, authorIsSupport: false,
      content: `msg-${i}`, attachments: [], timestamp: new Date(),
    }));
    await generateTranscript(TICKET, many, 'Test', TMP);
    const html = readFileSync(join(TMP, 'transcripts', 'g1', '42.html'), 'utf-8');
    expect(html).not.toContain('msg-500');
    expect(html).toContain('msg-499');
  });
});
