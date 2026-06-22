import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { meetingRoutes } from './meetings';
import { personalModuleRoutes } from './personal-modules';

describe('meetings routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(meetingRoutes, { prefix: '/v1/meetings' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/meetings',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'lists meetings, generates prep, and generates follow-up',
    async () => {
      const token = `meetings_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(personalModuleRoutes, { prefix: '/v1/personal-modules' });
        await app.register(meetingRoutes, { prefix: '/v1/meetings' });
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/personal-modules',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'meeting',
          title: 'Q3 Planning',
          dueAt: '2030-09-15T10:00:00Z',
          payload: {
            attendees: 'Alice, Bob',
            agenda: 'Review roadmap and set goals.',
          },
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/meetings',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].title).toBe('Q3 Planning');
      expect(listBody.data[0].attendees).toEqual(['Alice', 'Bob']);

      const prepResponse = await app.inject({
        method: 'POST',
        url: `/v1/meetings/${created.id}/prep`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(prepResponse.statusCode).toBe(200);
      const prepBody = JSON.parse(prepResponse.body);
      expect(typeof prepBody.draft).toBe('string');

      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/meetings/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(getResponse.statusCode).toBe(200);
      expect(JSON.parse(getResponse.body).prepDraft).toBe(prepBody.draft);

      const followUpResponse = await app.inject({
        method: 'POST',
        url: `/v1/meetings/${created.id}/follow-up`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(followUpResponse.statusCode).toBe(200);
      const followUpBody = JSON.parse(followUpResponse.body);
      expect(typeof followUpBody.draft).toBe('string');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 for a missing meeting', async () => {
    const token = `meetings_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(meetingRoutes, { prefix: '/v1/meetings' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/meetings/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
