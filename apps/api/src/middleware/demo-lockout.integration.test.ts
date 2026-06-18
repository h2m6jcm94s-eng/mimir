import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { budgetRoutes } from '../routes/budget';
import { demoStatusRoutes } from '../routes/demo';
import { buildTestApp } from '../test-helpers/build-app';
import { resolveAuthUser } from './auth';

describe('demo lockout middleware', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)(
    'blocks protected routes for expired demo tenants and allows whitelisted routes',
    async () => {
      const activeToken = `demo_active_${Date.now()}`;
      const expiredToken = `demo_expired_${Date.now()}`;

      const activeUser = await resolveAuthUser(activeToken, `${activeToken}@test.local`);
      const expiredUser = await resolveAuthUser(expiredToken, `${expiredToken}@test.local`);

      await withTenantTransaction(activeUser.tenantId, async (ctx) => {
        await ctx.tenantScopedDb
          .update(schema.tenant)
          .set({ demoExpiresAt: new Date('2099-12-31T23:59:59Z') })
          .where(eq(schema.tenant.id, activeUser.tenantId));
      });

      await withTenantTransaction(expiredUser.tenantId, async (ctx) => {
        await ctx.tenantScopedDb
          .update(schema.tenant)
          .set({ demoExpiresAt: new Date('2000-01-01T00:00:00Z') })
          .where(eq(schema.tenant.id, expiredUser.tenantId));
      });

      const app = await buildTestApp(async (app) => {
        await app.register(budgetRoutes, { prefix: '/v1/budget' });
        await app.register(demoStatusRoutes, { prefix: '/v1/demo' });
      });

      const activeBudget = await app.inject({
        method: 'GET',
        url: '/v1/budget',
        headers: { authorization: `Bearer ${activeToken}` },
      });
      expect(activeBudget.statusCode).toBe(200);

      const expiredBudget = await app.inject({
        method: 'GET',
        url: '/v1/budget',
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredBudget.statusCode).toBe(403);
      const expiredBody = JSON.parse(expiredBudget.body);
      expect(expiredBody.error.code).toBe('DEMO_EXPIRED');

      const expiredStatus = await app.inject({
        method: 'GET',
        url: '/v1/demo/status',
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredStatus.statusCode).toBe(200);
    }
  );
});
