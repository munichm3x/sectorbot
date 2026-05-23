import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the aiClient module ─────────────────────────────────────────────────

const mockAskAI = vi.fn();
const mockBuildProvider = vi.fn();

vi.mock('../aiClient', () => ({
  askAI:         (...args: unknown[]) => mockAskAI(...args),
  buildProvider: (...args: unknown[]) => mockBuildProvider(...args),
}));

// ─── Import AFTER mocking ─────────────────────────────────────────────────────

import { runTicketSummaryTask } from '../tasks/ticketSummaryTask';
import type { MessageEntry } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessages(n = 3): MessageEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    authorName:      `User${i}`,
    authorId:        `id-${i}`,
    isBot:           false,
    content:         `Nachricht ${i}`,
    attachmentCount: 0,
    timestamp:       new Date(),
  }));
}

const VALID_JSON_RESPONSE = JSON.stringify({
  short_summary:  'User braucht Whitelist.',
  problem:        'Nicht auf der Liste.',
  user_request:   'Freischaltung.',
  actions_taken:  'Steam ID geprüft.',
  resolution:     'Freigeschaltet.',
  open_points:    '',
  priority:       'medium',
  tags:           ['whitelist'],
  needs_followup: false,
});

function makeAskResult(text: string) {
  return { text, provider: 'groq', model: 'llama-3.3-70b-versatile', usedFallback: false, durationMs: 100, charLength: text.length };
}

describe('runTicketSummaryTask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('AI_TICKET_ENABLED', 'true');
    vi.stubEnv('AI_TICKET_PROVIDER', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null immediately when AI_TICKET_ENABLED is false', async () => {
    vi.stubEnv('AI_TICKET_ENABLED', 'false');
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Test');
    expect(result).toBeNull();
    expect(mockAskAI).not.toHaveBeenCalled();
  });

  it('returns TicketSummaryJSON on valid JSON response', async () => {
    mockAskAI.mockResolvedValue(makeAskResult(VALID_JSON_RESPONSE));
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User braucht Whitelist.');
    expect(result!.priority).toBe('medium');
  });

  it('retries once when first response is invalid JSON, returns JSON on retry', async () => {
    mockAskAI
      .mockResolvedValueOnce(makeAskResult('this is not json'))
      .mockResolvedValueOnce(makeAskResult(VALID_JSON_RESPONSE));

    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User braucht Whitelist.');
    expect(mockAskAI).toHaveBeenCalledTimes(2);
  });

  it('returns null when both attempts produce invalid JSON', async () => {
    mockAskAI.mockResolvedValue(makeAskResult('not json at all'));
    const result = await runTicketSummaryTask(undefined, makeMessages(), 'Whitelist');
    expect(result).toBeNull();
    expect(mockAskAI).toHaveBeenCalledTimes(2);
  });

  it('returns null when provider throws — never throws itself', async () => {
    mockAskAI.mockRejectedValue(new Error('network error'));
    await expect(runTicketSummaryTask(undefined, makeMessages(), 'Whitelist')).resolves.toBeNull();
  });
});
