import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { agentRoutes } from './agents';

describe('agents routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(agentRoutes, { prefix: '/v1/agents' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/agents',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('lists seeded agent roles', async () => {
    const externalId = `agents_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(agentRoutes, { prefix: '/v1/agents' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/agents',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.roles).toBeInstanceOf(Array);
    expect(body.roles.some((r: { kind: string }) => r.kind === 'main')).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('resolves a role to a provider', async () => {
    const externalId = `agents_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(agentRoutes, { prefix: '/v1/agents' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/agents/resolve',
      headers: { authorization: `Bearer ${externalId}` },
      payload: { kind: 'main', tier: 0 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.kind).toBe('main');
    expect(body.tier).toBe(0);
    expect(body.provider).toBeDefined();
  });
});
