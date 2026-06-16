import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { nodeRoutes } from './nodes';

describe('nodes routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(nodeRoutes, { prefix: '/v1/nodes' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/nodes',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns an empty list for a new tenant', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(nodeRoutes, { prefix: '/v1/nodes' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/nodes',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
  });
});
