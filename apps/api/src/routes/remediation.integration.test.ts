import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { remediationRoutes } from './remediation';

describe('remediation routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(remediationRoutes, { prefix: '/v1/remediations' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/remediations',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates a remediation run and resolves it', async () => {
    const token = `remediation_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(remediationRoutes, { prefix: '/v1/remediations' });
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/remediations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'service',
        targetId: 'test-service',
        issue: 'The service is returning 500 errors.',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const run = JSON.parse(createResponse.body).data;
    expect(run.targetType).toBe('service');
    expect(run.targetId).toBe('test-service');
    expect(run.status).toBe('resolved');
    expect(typeof run.action).toBe('string');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/remediations',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const list = JSON.parse(listResponse.body);
    expect(list.data.some((r: { id: string }) => r.id === run.id)).toBe(true);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/v1/remediations/${run.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getResponse.statusCode).toBe(200);
    expect(JSON.parse(getResponse.body).data.id).toBe(run.id);

    const resolveResponse = await app.inject({
      method: 'POST',
      url: `/v1/remediations/${run.id}/resolve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(JSON.parse(resolveResponse.body).data.status).toBe('resolved');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 for a missing run', async () => {
    const token = `remediation_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(remediationRoutes, { prefix: '/v1/remediations' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/remediations/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
