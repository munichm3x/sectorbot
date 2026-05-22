import { logger } from '../../utils/logger';
import { askAI, buildProvider } from '../aiClient';
import { buildTicketSummaryMessages } from '../prompts/ticketSummaryPrompt';
import { validateTicketSummary } from '../validation/validateTicketSummary';
import type { ChatMessage, TicketSummaryJSON, MessageEntry } from '../types';
import type { Ticket } from '../../types';

async function attemptWithProvider(msgs: ChatMessage[]): Promise<string | null> {
  try {
    const ticketProvider = process.env.AI_TICKET_PROVIDER ?? '';
    if (ticketProvider) {
      const p = buildProvider(ticketProvider, true);
      if (!p) return null;
      return await p.ask(msgs);
    }
    const r = await askAI(msgs);
    return r.text || null;
  } catch {
    return null;
  }
}

export async function runTicketSummaryTask(
  ticket:        Ticket | undefined,
  messages:      MessageEntry[],
  categoryLabel: string,
): Promise<TicketSummaryJSON | null> {
  // Read directly from process.env so vi.stubEnv works in tests
  // (env object is frozen at import time and won't reflect runtime stubs)
  const enabled = process.env.AI_TICKET_ENABLED;
  if (enabled === 'false' || enabled === '0' || enabled === 'no') return null;

  const taskMessages = buildTicketSummaryMessages(ticket, messages, categoryLabel);

  const rawFirst = await attemptWithProvider(taskMessages);
  if (!rawFirst) return null;

  const first = validateTicketSummary(rawFirst);
  if (first) return first;

  logger.warn('[ticketSummaryTask] JSON validation failed (attempt 1), retrying');

  const retryMessages: ChatMessage[] = [
    ...taskMessages,
    {
      role:    'user',
      content: '[RULE: Respond ONLY with valid JSON matching the schema. No preamble, no explanation, no markdown fences.]',
    },
  ];

  const rawSecond = await attemptWithProvider(retryMessages);
  if (!rawSecond) return null;

  const second = validateTicketSummary(rawSecond);
  if (!second) logger.warn('[ticketSummaryTask] JSON validation failed (attempt 2), giving up');
  return second;
}
