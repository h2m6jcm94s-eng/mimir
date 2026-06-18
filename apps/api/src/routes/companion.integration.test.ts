import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { companionRoutes } from './companion';

describe('companion routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(companionRoutes, { prefix: '/v1/companion' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/companion/check-ins',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates and lists check-ins', async () => {
    const token = `companion_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(companionRoutes, { prefix: '/v1/companion' });
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/companion/check-ins',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mood: 'good',
        note: 'Feeling productive',
        tags: ['work', 'focus'],
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.mood).toBe('good');
    expect(created.note).toBe('Feeling productive');
    expect(created.tags).toEqual(['work', 'focus']);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/companion/check-ins',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);
    expect(listBody.data[0].mood).toBe('good');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns a mood summary', async () => {
    const token = `companion_summary_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(companionRoutes, { prefix: '/v1/companion' });
    });

    await app.inject({
      method: 'POST',
      url: '/v1/companion/check-ins',
      headers: { authorization: `Bearer ${token}` },
      payload: { mood: 'great' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/companion/check-ins',
      headers: { authorization: `Bearer ${token}` },
      payload: { mood: 'okay' },
    });

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/v1/companion/check-ins/summary',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summary = JSON.parse(summaryResponse.body);
    expect(summary.total).toBe(2);
    expect(summary.byMood.great).toBe(1);
    expect(summary.byMood.okay).toBe(1);
    expect(summary.averageMoodScore).toBe(4);
  });
});
