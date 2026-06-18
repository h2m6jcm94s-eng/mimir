import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { metricsRoutes } from './metrics';

describe('metrics routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(metricsRoutes, { prefix: '/v1/metrics' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
    });

    expect(response.statusCode).toBe(401);
  });

  it('exposes prometheus exposition format', async () => {
    const externalId = `metrics_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(metricsRoutes, { prefix: '/v1/metrics' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('# HELP');
  });
});
