import type { AIProvider, ChatMessage } from '../types';

interface OllamaResponse {
  message?: { content?: string };
  error?:   string;
}

export class OllamaProvider implements AIProvider {
  readonly name  = 'ollama';
  readonly model: string;

  private readonly baseUrl:   string;
  private readonly timeoutMs: number;

  constructor(opts: {
    baseUrl?:   string;
    model?:     string;
    timeoutMs?: number;
  }) {
    this.baseUrl   = (opts.baseUrl   ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model     = opts.model     ?? 'sector13-oldman';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  async ask(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: this.model, messages, stream: false }),
        signal:  controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as OllamaResponse;
      const text = (data.message?.content ?? '').trim();
      if (!text) throw new Error('Ollama returned empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
