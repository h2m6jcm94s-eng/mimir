import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { personalModuleRoutes } from './personal-modules';

describe('personal-modules routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(personalModuleRoutes, { prefix: '/v1/personal-modules' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/personal-modules?kind=finance',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates, lists, updates, marks done, and deletes a personal module',
    async () => {
      const token = `personal_modules_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(personalModuleRoutes, { prefix: '/v1/personal-modules' });
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/personal-modules',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'finance',
          title: 'Cancel old subscription',
          description: 'Review and cancel unused SaaS subscriptions.',
          payload: { amount: 49.99, currency: 'USD' },
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.id).toBeDefined();
      expect(created.kind).toBe('finance');
      expect(created.status).toBe('active');

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/personal-modules?kind=finance',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].title).toBe('Cancel old subscription');

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/personal-modules/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(JSON.parse(updateResponse.body).status).toBe('done');

      const doneResponse = await app.inject({
        method: 'POST',
        url: `/v1/personal-modules/${created.id}/done`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(doneResponse.statusCode).toBe(200);
      expect(JSON.parse(doneResponse.body).status).toBe('done');

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/personal-modules/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(deleteResponse.statusCode).toBe(204);

      const listAfterResponse = await app.inject({
        method: 'GET',
        url: '/v1/personal-modules?kind=finance',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(JSON.parse(listAfterResponse.body).data.length).toBe(0);
    }
  );
});
