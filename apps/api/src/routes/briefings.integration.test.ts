import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { briefingRoutes } from './briefings';

describe('briefings routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(briefingRoutes, { prefix: '/v1/briefings' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/briefings',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('generates and lists briefings', async () => {
    const externalId = `briefings_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(briefingRoutes, { prefix: '/v1/briefings' });
    });

    const generateResponse = await app.inject({
      method: 'POST',
      url: '/v1/briefings/generate',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(generateResponse.statusCode).toBe(201);
    const generateBody = JSON.parse(generateResponse.body);
    expect(generateBody.items).toBeInstanceOf(Array);
    expect(generateBody.items.length).toBeGreaterThan(0);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/briefings?limit=10',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toBeInstanceOf(Array);
    expect(listBody.data.length).toBeGreaterThan(0);
  });
});
