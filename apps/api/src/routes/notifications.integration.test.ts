import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { notificationRoutes } from './notifications';

describe('notifications routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(notificationRoutes, { prefix: '/v1/notifications' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/notifications',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates and deduplicates notifications', async () => {
    const externalId = `notifications_user_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(notificationRoutes, { prefix: '/v1/notifications' });
    });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/notifications',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        kind: 'test',
        title: 'Test notification',
        body: 'Hello',
        dedupKey: 'dedup-test',
        channels: ['in_app'],
      }),
    });

    expect(first.statusCode).toBe(201);
    const firstBody = JSON.parse(first.body);
    expect(firstBody.deduplicated).toBe(false);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/notifications',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        kind: 'test',
        title: 'Test notification',
        body: 'Hello',
        dedupKey: 'dedup-test',
        channels: ['in_app'],
      }),
    });

    expect(second.statusCode).toBe(201);
    const secondBody = JSON.parse(second.body);
    expect(secondBody.deduplicated).toBe(true);
    expect(secondBody.notification.id).toBe(firstBody.notification.id);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/notifications?limit=10',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toBeInstanceOf(Array);
    expect(listBody.data.length).toBe(1);

    const readResponse = await app.inject({
      method: 'POST',
      url: `/v1/notifications/${firstBody.notification.id}/read`,
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(readResponse.statusCode).toBe(200);
    const readBody = JSON.parse(readResponse.body);
    expect(readBody.readAt).not.toBeNull();
  });
});
