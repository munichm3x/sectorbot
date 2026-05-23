/**
 * Gemini AI Provider — Google Generative Language API (REST, no extra package).
 *
 * Default model: gemini-1.5-flash (free tier, generous limits).
 * API docs: https://ai.google.dev/api/generate-content
 */

import type { AIProvider, ChatMessage } from '../types';

// Gemini uses a different role vocabulary: "user" / "model" (not "assistant")
interface GeminiPart  { text: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }

interface GeminiRequest {
  system_instruction?: { parts: GeminiPart[] };
  contents:            GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?:     number;
  };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

export class GeminiProvider implements AIProvider {
  readonly name  = 'gemini';
  readonly model: string;

  private readonly apiKey:     string;
  private readonly maxTokens:  number;
  private readonly temperature: number;
  private readonly timeoutMs:  number;

  constructor(opts: {
    apiKey:      string;
    model?:      string;
    maxTokens?:  number;
    temperature?: number;
    timeoutMs?:  number;
  }) {
    this.apiKey      = opts.apiKey;
    this.model       = opts.model       ?? 'gemini-1.5-flash-8b';
    this.maxTokens   = opts.maxTokens   ?? 300;
    this.temperature = opts.temperature ?? 0.82;
    this.timeoutMs   = opts.timeoutMs   ?? 20_000;
  }

  async ask(messages: ChatMessage[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs  = messages.filter(m => m.role !== 'system');

    // Convert to Gemini content format
    const contents: GeminiContent[] = chatMsgs.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Gemini requires alternating user/model turns — merge consecutive same-role turns
    const merged: GeminiContent[] = [];
    for (const c of contents) {
      const last = merged[merged.length - 1];
      if (last && last.role === c.role) {
        last.parts[0].text += '\n' + c.parts[0].text;
      } else {
        merged.push({ ...c, parts: [{ text: c.parts[0].text }] });
      }
    }

    // Must start with "user" turn
    if (merged.length === 0 || merged[0].role !== 'user') {
      merged.unshift({ role: 'user', parts: [{ text: '...' }] });
    }

    const body: GeminiRequest = {
      contents: merged,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature:     this.temperature,
      },
    };

    if (systemMsg) {
      body.system_instruction = { parts: [{ text: systemMsg.content }] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      // Read body as text first so we never get SyntaxError on empty bodies
      const rawText = await res.text();

      if (!res.ok) {
        // Try to extract a meaningful error message
        let errMsg = `Gemini HTTP ${res.status}`;
        try {
          const errData = JSON.parse(rawText) as GeminiResponse;
          if (errData.error?.message) errMsg = `Gemini API error: ${errData.error.message}`;
        } catch { /* ignore, rawText was not JSON */ }
        throw new Error(errMsg);
      }

      const data = JSON.parse(rawText) as GeminiResponse;

      if (data.error?.message) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      if (!text) throw new Error('Gemini returned empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
