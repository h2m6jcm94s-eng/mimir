import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { resolveAuthUser } from '../middleware/auth';
import { hashPin } from '../services/approvals/metadata';
import { buildTestApp } from '../test-helpers/build-app';
import { userRoutes } from './users';

describe('users routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(userRoutes, { prefix: '/v1/users' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/pin',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('sets a PIN when none is configured', async () => {
    const token = `users_pin_set_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(userRoutes, { prefix: '/v1/users' });
    });

    const user = await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/pin',
      headers: { authorization: `Bearer ${token}` },
      payload: { pin: '1234' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);

    const account = await db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, user.userAccountId),
    });
    expect(account?.pinHash).toBe(hashPin('1234'));
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'requires the current PIN to change an existing PIN',
    async () => {
      const token = `users_pin_change_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(userRoutes, { prefix: '/v1/users' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      await db
        .update(schema.userAccount)
        .set({ pinHash: hashPin('1234') })
        .where(eq(schema.userAccount.id, user.userAccountId));

      const missingCurrent = await app.inject({
        method: 'POST',
        url: '/v1/users/me/pin',
        headers: { authorization: `Bearer ${token}` },
        payload: { pin: '5678' },
      });
      expect(missingCurrent.statusCode).toBe(403);

      const wrongCurrent = await app.inject({
        method: 'POST',
        url: '/v1/users/me/pin',
        headers: { authorization: `Bearer ${token}` },
        payload: { pin: '5678', currentPin: '0000' },
      });
      expect(wrongCurrent.statusCode).toBe(403);

      const correctCurrent = await app.inject({
        method: 'POST',
        url: '/v1/users/me/pin',
        headers: { authorization: `Bearer ${token}` },
        payload: { pin: '5678', currentPin: '1234' },
      });
      expect(correctCurrent.statusCode).toBe(200);

      const account = await db.query.userAccount.findFirst({
        where: eq(schema.userAccount.id, user.userAccountId),
      });
      expect(account?.pinHash).toBe(hashPin('5678'));
    }
  );
});
