import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { lifeAdminRoutes } from './life-admin';

describe('life-admin routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(lifeAdminRoutes, { prefix: '/v1/life-admin' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/life-admin/upcoming',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates, lists, and completes a life admin item',
    async () => {
      const token = `life_admin_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(lifeAdminRoutes, { prefix: '/v1/life-admin' });
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const isoDue = dueDate.toISOString();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/life-admin',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Renew passport',
          description: 'Submit passport renewal form and photo.',
          dueDate: isoDue,
          recurrence: 'yearly',
          category: 'Documents',
          tags: ['travel', 'gov'],
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.id).toBeDefined();
      expect(created.title).toBe('Renew passport');
      expect(created.status).toBe('pending');
      expect(created.recurrence).toBe('yearly');

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/life-admin/upcoming?status=pending&limit=10',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBeGreaterThan(0);
      expect(listBody.data[0].title).toBe('Renew passport');

      const doneResponse = await app.inject({
        method: 'POST',
        url: `/v1/life-admin/${created.id}/done`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(doneResponse.statusCode).toBe(200);
      const doneBody = JSON.parse(doneResponse.body);
      expect(doneBody.completed.status).toBe('done');
      expect(doneBody.next).toBeDefined();
      expect(doneBody.next.title).toBe('Renew passport');
      expect(doneBody.next.status).toBe('pending');
    }
  );
});
