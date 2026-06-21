import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { startMockServer } from '../services/models/providers/test-utils';
import { buildTestApp } from '../test-helpers/build-app';
import { localModelRoutes } from './local-models';

describe('local model routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(localModelRoutes, { prefix: '/v1/models/local' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/models/local/status',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns default config and offline status', async () => {
    const token = `local_models_default_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(localModelRoutes, { prefix: '/v1/models/local' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/models/local/config',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.baseUrl).toBe('http://localhost:11434');
    expect(body.data.chatModel).toBe('mimir-local');
    expect(body.data.enabled).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('saves config and probes a mocked Ollama', async () => {
    const server = await startMockServer((req, res) => {
      if (req.url === '/api/tags' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            models: [
              { name: 'llama3.1:latest', size: 4_000_000_000 },
              { name: 'nomic-embed-text:latest', size: 200_000_000 },
            ],
          })
        );
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    try {
      const token = `local_models_mock_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(localModelRoutes, { prefix: '/v1/models/local' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      const putResponse = await app.inject({
        method: 'PUT',
        url: '/v1/models/local/config',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          baseUrl: server.baseUrl,
          chatModel: 'llama3.1',
          embeddingModel: 'nomic-embed-text',
          embeddingDimension: 768,
          enabled: true,
        },
      });

      expect(putResponse.statusCode).toBe(200);
      const putBody = JSON.parse(putResponse.body);
      expect(putBody.data.baseUrl).toBe(server.baseUrl);

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/v1/models/local/status',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.data.reachable).toBe(true);
      expect(statusBody.data.chatAvailable).toBe(true);
      expect(statusBody.data.embedAvailable).toBe(true);
      expect(statusBody.data.models).toHaveLength(2);
    } finally {
      await server.close();
    }
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('lists models from mocked Ollama', async () => {
    const server = await startMockServer((req, res) => {
      if (req.url === '/api/tags' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'llama3.1:latest' }] }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    try {
      const token = `local_models_list_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(localModelRoutes, { prefix: '/v1/models/local' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      await app.inject({
        method: 'PUT',
        url: '/v1/models/local/config',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          baseUrl: server.baseUrl,
          chatModel: 'llama3.1',
          embeddingModel: 'nomic-embed-text',
          embeddingDimension: 768,
          enabled: true,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/models/local',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.models).toHaveLength(1);
      expect(body.data.models[0].name).toBe('llama3.1:latest');
    } finally {
      await server.close();
    }
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('pulls a model through mocked Ollama', async () => {
    const server = await startMockServer((req, res) => {
      if (req.url === '/api/pull' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    try {
      const token = `local_models_pull_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(localModelRoutes, { prefix: '/v1/models/local' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      await app.inject({
        method: 'PUT',
        url: '/v1/models/local/config',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          baseUrl: server.baseUrl,
          chatModel: 'llama3.1',
          embeddingModel: 'nomic-embed-text',
          embeddingDimension: 768,
          enabled: true,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/models/local/pull',
        headers: { authorization: `Bearer ${token}` },
        payload: { model: 'llama3.1' },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.data.jobId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.data.status).toBe('queued');
    } finally {
      await server.close();
    }
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'sets up the Mimir Local model through mocked Ollama',
    async () => {
      const server = await startMockServer((req, res) => {
        if (req.url === '/api/pull' && req.method === 'POST') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
          return;
        }
        if (req.url === '/api/create' && req.method === 'POST') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
          return;
        }
        res.writeHead(404);
        res.end('not found');
      });

      try {
        const token = `local_models_setup_${Date.now()}`;
        const app = await buildTestApp(async (app) => {
          await app.register(localModelRoutes, { prefix: '/v1/models/local' });
        });

        await resolveAuthUser(token, `${token}@test.local`);

        await app.inject({
          method: 'PUT',
          url: '/v1/models/local/config',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            baseUrl: server.baseUrl,
            chatModel: 'llama3.1',
            embeddingModel: 'nomic-embed-text',
            embeddingDimension: 768,
            enabled: true,
          },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/v1/models/local/setup-mimir',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        expect(body.data.jobId).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.data.status).toBe('queued');

        const configResponse = await app.inject({
          method: 'GET',
          url: '/v1/models/local/config',
          headers: { authorization: `Bearer ${token}` },
        });
        const configBody = JSON.parse(configResponse.body);
        expect(configBody.data.chatModel).toBe('mimir-local');
      } finally {
        await server.close();
      }
    }
  );
});
