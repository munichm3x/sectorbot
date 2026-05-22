// src/ai/tasks/oldManLoreTask.ts
import { logger } from '../../utils/logger';
import { askAI, buildProvider } from '../aiClient';
import type { ChatMessage, AskResult } from '../types';

export const NO_REPLY        = 'NO_REPLY';
const SIMILARITY_THRESH      = 0.62;

export interface OldManTaskResult {
  reply:    string | null;
  noReply:  boolean;
  attempts: AskResult[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
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

export function isTooSimilar(candidate: string, previousReplies: string[]): boolean {
  return previousReplies.some(prev => jaccardSimilarity(candidate, prev) >= SIMILARITY_THRESH);
}

async function callAI(messages: ChatMessage[]): Promise<AskResult | null> {
  try {
    if (process.env.AI_OLDMAN_PROVIDER) {
      const p = buildProvider(process.env.AI_OLDMAN_PROVIDER, true);
      if (!p) return null;
      const t0   = Date.now();
      const text = await p.ask(messages);
      return {
        text,
        provider:     p.name,
        model:        p.model,
        usedFallback: false,
        durationMs:   Date.now() - t0,
        charLength:   text.length,
      };
    }
    return await askAI(messages);
  } catch {
    return null;
  }
}

export async function runOldManLoreTask(
  messages:   ChatMessage[],
  botReplies: string[],
): Promise<OldManTaskResult> {
  const attempts: AskResult[] = [];

  const result = await callAI(messages);
  if (!result) return { reply: null, noReply: false, attempts };

  attempts.push(result);
  if (!result.text)                        return { reply: null, noReply: false, attempts };
  if (result.text.trim() === NO_REPLY)     return { reply: null, noReply: true,  attempts };

  if (isTooSimilar(result.text, botReplies)) {
    logger.info('[oldManLoreTask] Anti-Repeat: zu ähnlich, ein Retry');

    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: result.text },
      {
        role:    'user',
        content: '[INTERN: Diese Antwort ist zu ähnlich zu deinen vorherigen. Formuliere komplett anders — oder antworte mit NO_REPLY.]',
      },
    ];

    const retry = await callAI(retryMessages);
    if (!retry) return { reply: null, noReply: false, attempts };

    attempts.push(retry);

    if (!retry.text || retry.text.trim() === NO_REPLY || isTooSimilar(retry.text, botReplies)) {
      logger.info('[oldManLoreTask] Anti-Repeat Retry: immer noch ähnlich/NO_REPLY, kein Senden');
      return { reply: null, noReply: true, attempts };
    }

    return { reply: retry.text, noReply: false, attempts };
  }

  return { reply: result.text, noReply: false, attempts };
}
