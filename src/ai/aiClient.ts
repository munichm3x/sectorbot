/**
 * AIClient — central AI routing layer.
 *
 * - Selects the primary provider based on AI_PROVIDER env var
 * - Falls back to AI_FALLBACK_PROVIDER on error
 * - Logs every call: provider, model, char length, duration, fallback used, errors
 * - Applies the QualityGate before returning
 * - Returns a typed AskResult (never throws)
 */

import { env } from '../config/env';
import { logger } from '../utils/logger';
import { GeminiProvider }      from './providers/geminiProvider';
import { GroqProvider }         from './providers/groqProvider';
import { OpenRouterProvider }   from './providers/openRouterProvider';
import { OllamaProvider }       from './providers/ollamaProvider';
import { validateAiReply }      from './validation/validateAiReply';
import type { AIProvider, ChatMessage, AskResult } from './types';

// ─── Provider factory ─────────────────────────────────────────────────────────

export function buildProvider(name: string, usePrimaryModel: boolean): AIProvider | null {
  const modelOverride = usePrimaryModel ? (env.AI_MODEL || undefined) : undefined;

  switch (name.toLowerCase()) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) return null;
      return new GeminiProvider({
        apiKey:  env.GEMINI_API_KEY,
        model:   modelOverride ?? 'gemini-1.5-flash-8b',
      });

    case 'groq':
      if (!env.GROQ_API_KEY) return null;
      return new GroqProvider({
        apiKey: env.GROQ_API_KEY,
        model:  modelOverride ?? 'llama-3.3-70b-versatile',
      });

    case 'openrouter':
      if (!env.OPENROUTER_API_KEY) return null;
      return new OpenRouterProvider({
        apiKey: env.OPENROUTER_API_KEY,
        model:  modelOverride ?? 'meta-llama/llama-3-8b-instruct:free',
      });

    case 'ollama':
      return new OllamaProvider({
        baseUrl:   env.OLLAMA_BASE_URL,
        model:     env.OLLAMA_MODEL,
        timeoutMs: env.OLLAMA_TIMEOUT_MS,
      });

    default:
      return null;
  }
}

// ─── Singleton providers (built once at startup) ──────────────────────────────

let primaryProvider:  AIProvider | null = null;
let fallbackProvider: AIProvider | null = null;
let providersReady    = false;

function ensureProviders(): void {
  if (providersReady) return;
  providersReady = true;

  primaryProvider  = buildProvider(env.AI_PROVIDER ?? 'gemini', true);
  fallbackProvider = buildProvider(env.AI_FALLBACK_PROVIDER ?? 'groq', false);

  if (primaryProvider) {
    logger.info(`[AIClient] Primary provider: ${primaryProvider.name} / ${primaryProvider.model}`);
  } else {
    logger.warn(`[AIClient] No primary provider configured (AI_PROVIDER=${env.AI_PROVIDER ?? 'gemini'}) — check API key`);
  }

  if (fallbackProvider) {
    logger.info(`[AIClient] Fallback provider: ${fallbackProvider.name} / ${fallbackProvider.model}`);
  }
}

// ─── Main ask function ────────────────────────────────────────────────────────

/**
 * Send a chat completion request.
 * Always returns an AskResult — never throws.
 * The caller decides what to do with failures (use randomFallback, skip, etc.).
 */
export async function askAI(messages: ChatMessage[]): Promise<AskResult> {
  ensureProviders();

  const t0 = Date.now();

  // ── Try primary ────────────────────────────────────────────────────────────
  if (primaryProvider) {
    try {
      const raw = await primaryProvider.ask(messages);
      return buildResult(raw, primaryProvider, t0, false, messages);
    } catch (err) {
      logger.warn(`[AIClient] Primary (${primaryProvider.name}) failed: ${String(err)}`);
    }
  }

  // ── Try fallback ───────────────────────────────────────────────────────────
  if (fallbackProvider) {
    try {
      const raw = await fallbackProvider.ask(messages);
      return buildResult(raw, fallbackProvider, t0, true, messages);
    } catch (err) {
      logger.warn(`[AIClient] Fallback (${fallbackProvider.name}) failed: ${String(err)}`);
    }
  }

  // ── Both failed ────────────────────────────────────────────────────────────
  logger.error('[AIClient] All providers failed — no AI response available');
  return {
    text:         '',
    provider:     'none',
    model:        'none',
    usedFallback: false,
    durationMs:   Date.now() - t0,
    charLength:   0,
    error:        'all_providers_failed',
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildResult(
  rawText:      string,
  provider:     AIProvider,
  t0:           number,
  usedFallback: boolean,
  messages:     ChatMessage[],
): AskResult {
  // Extract the current question from the last user message for the quality gate
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  const qr = validateAiReply(rawText, lastUser);

  const durationMs = Date.now() - t0;

  if (qr.reasons.length > 0) {
    logger.info(
      `[AIClient] QualityGate [${provider.name}/${provider.model}] ` +
      `pass=${qr.pass} issues=[${qr.reasons.join(', ')}] ` +
      `len=${rawText.length}→${qr.text.length} dur=${durationMs}ms fallback=${usedFallback}`,
    );
  } else {
    logger.info(
      `[AIClient] [${provider.name}/${provider.model}] ` +
      `len=${qr.text.length} dur=${durationMs}ms fallback=${usedFallback}`,
    );
  }

  return {
    text:         qr.pass ? qr.text : '',
    provider:     provider.name,
    model:        provider.model,
    usedFallback,
    durationMs,
    charLength:   qr.text.length,
    error:        qr.pass ? undefined : `quality_gate_failed: [${qr.reasons.join(', ')}]`,
  };
}
