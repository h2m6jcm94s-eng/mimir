import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { modelLeaderboardRoutes } from './model-leaderboard';

describe('model leaderboard routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(modelLeaderboardRoutes, { prefix: '/v1/models/leaderboard' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/models/leaderboard',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'records invocations and returns aggregated leaderboard',
    async () => {
      const token = `model_leaderboard_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(modelLeaderboardRoutes, { prefix: '/v1/models/leaderboard' });
      });

      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/v1/models/leaderboard/invocations',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            tier: 1,
            status: 'success',
            latencyMs: 120 + i * 10,
            promptTokens: 100,
            completionTokens: 50,
            costUsd: 0.0012,
          },
        });
        expect(res.statusCode).toBe(201);
      }

      await app.inject({
        method: 'POST',
        url: '/v1/models/leaderboard/invocations',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          tier: 1,
          status: 'error',
          latencyMs: 200,
          errorCode: 'RATE_LIMIT',
        },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/models/leaderboard?days=30',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.data.length).toBe(1);
      expect(body.data[0].provider).toBe('openai');
      expect(body.data[0].model).toBe('gpt-4o-mini');
      expect(body.data[0].total).toBe(4);
      expect(body.data[0].success).toBe(3);
      expect(body.data[0].error).toBe(1);
      expect(body.data[0].avgLatencyMs).toBeGreaterThan(0);
    }
  );
});
