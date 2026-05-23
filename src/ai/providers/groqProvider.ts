/**
 * Groq AI Provider — OpenAI-compatible API.
 * Extracted from oldManLore.ts to keep provider logic modular.
 *
 * Docs: https://console.groq.com/docs/openai
 */

import type { AIProvider, ChatMessage } from '../types';

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
}

export class GroqProvider implements AIProvider {
  readonly name  = 'groq';
  readonly model: string;

  private readonly apiKey:      string;
  private readonly maxTokens:   number;
  private readonly temperature: number;
  private readonly timeoutMs:   number;

  constructor(opts: {
    apiKey:       string;
    model?:       string;
    maxTokens?:   number;
    temperature?: number;
    timeoutMs?:   number;
  }) {
    this.apiKey      = opts.apiKey;
    this.model       = opts.model       ?? 'llama-3.3-70b-versatile';
    this.maxTokens   = opts.maxTokens   ?? 220;
    this.temperature = opts.temperature ?? 0.82;
    this.timeoutMs   = opts.timeoutMs   ?? 15_000;
  }

  async ask(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model:       this.model,
          messages,
          max_tokens:  this.maxTokens,
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as GroqResponse;
      const text = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!text) throw new Error('Groq returned empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
