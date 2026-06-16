import { describe, expect, it } from 'vitest';
import { setTokenVerifier } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { sessionRoutes } from './sessions';

describe('sessions routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { source: 'web' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 201 with a valid bearer token', async () => {
    setTokenVerifier(async (token: string) => {
      if (!token) throw new Error('Missing token');
      return { sub: `clerk_sessions_user_${Date.now()}` };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: 'Bearer valid-token' },
      payload: { source: 'web' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.tenantId).toBeDefined();
  });
});
