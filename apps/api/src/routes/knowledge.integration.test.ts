import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { authMiddleware, registerAuth, setTokenVerifier } from '../middleware/auth';
import { knowledgeRoutes } from './knowledge';

describe('knowledge routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = Fastify();
    await registerAuth(app);
    app.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith('/v1/')) {
        await authMiddleware(request, reply);
      }
    });
    app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      payload: { kind: 'doc', content: 'hello world' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('ingests a document and searches by keyword', async () => {
    const clerkId = `clerk_knowledge_user_${Date.now()}`;
    setTokenVerifier(async (token: string) => {
      if (!token) throw new Error('Missing token');
      return { sub: clerkId };
    });

    const app = Fastify();
    await registerAuth(app);
    app.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith('/v1/')) {
        await authMiddleware(request, reply);
      }
    });
    app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });

    const ingestResponse = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        kind: 'doc',
        uri: 'file:///test.txt',
        content:
          'PostgreSQL is a powerful, open source object-relational database system. ' +
          'It has more than 35 years of active development and a proven architecture.',
      },
    });

    expect(ingestResponse.statusCode).toBe(201);
    const ingestBody = JSON.parse(ingestResponse.body);
    expect(ingestBody.itemId).toBeDefined();
    expect(ingestBody.chunks).toBeGreaterThan(0);

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/search?q=PostgreSQL&limit=5',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchBody = JSON.parse(searchResponse.body);
    expect(searchBody.data.length).toBeGreaterThan(0);
    expect(searchBody.data[0]?.text).toContain('PostgreSQL');
  });
});
