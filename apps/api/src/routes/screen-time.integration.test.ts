import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { screenTimeRoutes } from './screen-time';

describe('screen-time routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(screenTimeRoutes, { prefix: '/v1/screen-time' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/screen-time/entries',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates, lists, summarizes, and deletes screen-time entries',
    async () => {
      const token = `screen_time_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(screenTimeRoutes, { prefix: '/v1/screen-time' });
      });

      const today = new Date().toISOString().slice(0, 10);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/screen-time/entries',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          date: today,
          app: 'Social media',
          category: 'Social',
          minutes: 45,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.id).toBeDefined();
      expect(created.date).toBe(today);
      expect(created.minutes).toBe(45);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/v1/screen-time/entries?from=${today}&to=${today}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].app).toBe('Social media');

      const summaryResponse = await app.inject({
        method: 'GET',
        url: `/v1/screen-time/summary?from=${today}&to=${today}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(summaryResponse.statusCode).toBe(200);
      const summary = JSON.parse(summaryResponse.body);
      expect(summary.totalMinutes).toBe(45);
      expect(summary.entryCount).toBe(1);
      expect(summary.dailyTotals[today]).toBe(45);
      expect(summary.categoryBreakdown.Social).toBe(45);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/screen-time/entries/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(deleteResponse.statusCode).toBe(204);

      const listAfterResponse = await app.inject({
        method: 'GET',
        url: `/v1/screen-time/entries?from=${today}&to=${today}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(JSON.parse(listAfterResponse.body).data.length).toBe(0);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 when deleting a missing entry', async () => {
    const token = `screen_time_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(screenTimeRoutes, { prefix: '/v1/screen-time' });
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/screen-time/entries/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
