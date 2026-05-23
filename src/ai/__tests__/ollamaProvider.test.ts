import { describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../providers/ollamaProvider';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('OllamaProvider', () => {
  it('returns text content from successful response', async () => {
    const fetchMock = makeFetch(200, { message: { content: 'Ich war mal in einem Bunker.' } });
    vi.stubGlobal('fetch', fetchMock);

    const p = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'test-model' });
    const result = await p.ask([{ role: 'user', content: 'erzähl was' }]);

    expect(result).toBe('Ich war mal in einem Bunker.');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when message content is empty', async () => {
    vi.stubGlobal('fetch', makeFetch(200, { message: { content: '' } }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama returned empty response');
  });

  it('throws when response content is missing', async () => {
    vi.stubGlobal('fetch', makeFetch(200, { message: {} }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama returned empty response');
  });

  it('throws on HTTP 500', async () => {
    vi.stubGlobal('fetch', makeFetch(500, { error: 'server error' }));
    const p = new OllamaProvider({ model: 'test-model' });
    await expect(p.ask([{ role: 'user', content: 'hallo' }])).rejects.toThrow('Ollama HTTP 500');
  });

  it('sets correct provider name and model', () => {
    const p = new OllamaProvider({ model: 'sector13-oldman' });
    expect(p.name).toBe('ollama');
    expect(p.model).toBe('sector13-oldman');
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetchMock = makeFetch(200, { message: { content: 'antwort' } });
    vi.stubGlobal('fetch', fetchMock);
    const p = new OllamaProvider({ baseUrl: 'http://localhost:11434/' });
    await p.ask([{ role: 'user', content: 'test' }]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.anything());
  });
});
