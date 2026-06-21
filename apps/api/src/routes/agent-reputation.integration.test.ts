import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { agentReputationRoutes } from './agent-reputation';

describe('agent reputation routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(agentReputationRoutes, { prefix: '/v1/agents/reputation' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/agents/reputation',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('records feedback and lists agent reputations', async () => {
    const token = `agent_reputation_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(agentReputationRoutes, { prefix: '/v1/agents/reputation' });
    });

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/reputation/coder/feedback',
        headers: { authorization: `Bearer ${token}` },
        payload: { outcome: 'success' },
      });
      expect(res.statusCode).toBe(201);
    }

    const failResponse = await app.inject({
      method: 'POST',
      url: '/v1/agents/reputation/coder/feedback',
      headers: { authorization: `Bearer ${token}` },
      payload: { outcome: 'failure' },
    });
    expect(failResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/agents/reputation',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const body = JSON.parse(listResponse.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].role).toBe('coder');
    expect(body.data[0].successCount).toBe(2);
    expect(body.data[0].failureCount).toBe(1);
    expect(body.data[0].score).toBe(1);
  });
});
