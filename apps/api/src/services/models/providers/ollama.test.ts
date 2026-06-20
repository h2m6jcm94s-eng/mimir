import { describe, expect, it } from 'vitest';
import { OllamaProvider } from './ollama';
import { startMockServer } from './test-utils';

describe('OllamaProvider', () => {
  it('calls /api/chat with a messages array', async () => {
    const server = await startMockServer((req, res) => {
      expect(req.url).toBe('/api/chat');
      expect(req.method).toBe('POST');

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        expect(parsed.model).toBe('llama3.1');
        expect(parsed.messages).toEqual([{ role: 'user', content: 'hello' }]);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: { role: 'assistant', content: 'hi there' } }));
      });
    });

    try {
      const provider = new OllamaProvider({ baseUrl: server.baseUrl, chatModel: 'llama3.1' });
      const output = await provider.invoke({ prompt: 'hello', payload: {} }, { tier: 0 });

      expect(output.text).toBe('hi there');
      expect(output.provider).toBe('ollama');
      expect(output.tier).toBe(0);
      expect(output.model).toBe('llama3.1');
    } finally {
      await server.close();
    }
  });

  it('uses provided messages from payload', async () => {
    const server = await startMockServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        expect(parsed.messages).toHaveLength(2);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: { role: 'assistant', content: 'ok' } }));
      });
    });

    try {
      const provider = new OllamaProvider({ baseUrl: server.baseUrl });
      const output = await provider.invoke(
        {
          prompt: 'ignored',
          payload: {
            messages: [
              { role: 'system', content: 'you are helpful' },
              { role: 'user', content: 'hello' },
            ],
          },
        },
        { tier: 0 }
      );

      expect(output.text).toBe('ok');
    } finally {
      await server.close();
    }
  });

  it('throws on Ollama error', async () => {
    const server = await startMockServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'model not found' }));
    });

    try {
      const provider = new OllamaProvider({ baseUrl: server.baseUrl });
      await expect(provider.invoke({ prompt: 'hello', payload: {} }, { tier: 0 })).rejects.toThrow(
        'Ollama error: model not found'
      );
    } finally {
      await server.close();
    }
  });
});
