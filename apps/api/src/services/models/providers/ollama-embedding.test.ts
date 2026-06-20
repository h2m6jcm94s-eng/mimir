import { describe, expect, it } from 'vitest';
import { OllamaEmbeddingProvider } from './ollama-embedding';
import { startMockServer } from './test-utils';

describe('OllamaEmbeddingProvider', () => {
  it('returns a vector and dimension from /api/embeddings', async () => {
    const server = await startMockServer((req, res) => {
      expect(req.url).toBe('/api/embeddings');
      expect(req.method).toBe('POST');

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        expect(parsed.model).toBe('nomic-embed-text');
        expect(parsed.prompt).toBe('hello world');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }));
      });
    });

    try {
      const provider = new OllamaEmbeddingProvider({
        baseUrl: server.baseUrl,
        embeddingModel: 'nomic-embed-text',
      });
      const result = await provider.embed('hello world');

      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.dimension).toBe(3);
    } finally {
      await server.close();
    }
  });

  it('throws when the response has no embedding', async () => {
    const server = await startMockServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({}));
    });

    try {
      const provider = new OllamaEmbeddingProvider({ baseUrl: server.baseUrl });
      await expect(provider.embed('hello')).rejects.toThrow('no embedding vector');
    } finally {
      await server.close();
    }
  });
});
