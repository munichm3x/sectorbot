/**
 * OpenRouter AI Provider — routes to 100+ models via OpenAI-compatible API.
 * Optional fallback provider.
 *
 * Docs: https://openrouter.ai/docs
 * Free models: https://openrouter.ai/models?q=free
 */

import type { AIProvider, ChatMessage } from '../types';

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?:   { message?: string };
}

export class OpenRouterProvider implements AIProvider {
  readonly name  = 'openrouter';
  readonly model: string;

  private readonly apiKey:      string;
  private readonly maxTokens:   number;
  private readonly temperature: number;
  private readonly timeoutMs:   number;

  constructor(opts: {
    apiKey:       string;
    /** e.g. "mistralai/mistral-7b-instruct:free" or "meta-llama/llama-3-8b-instruct:free" */
    model?:       string;
    maxTokens?:   number;
    temperature?: number;
    timeoutMs?:   number;
  }) {
    this.apiKey      = opts.apiKey;
    this.model       = opts.model       ?? 'meta-llama/llama-3-8b-instruct:free';
    this.maxTokens   = opts.maxTokens   ?? 220;
    this.temperature = opts.temperature ?? 0.82;
    this.timeoutMs   = opts.timeoutMs   ?? 20_000;
  }

  async ask(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer':  'https://github.com/sectorbot',
          'X-Title':       'SectorBot',
        },
        body: JSON.stringify({
          model:       this.model,
          messages,
          max_tokens:  this.maxTokens,
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });

      const data = await res.json() as OpenRouterResponse;

      if (data.error?.message) {
        throw new Error(`OpenRouter error: ${data.error.message}`);
      }
      if (!res.ok) {
        throw new Error(`OpenRouter HTTP ${res.status}`);
      }

      const text = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!text) throw new Error('OpenRouter returned empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
