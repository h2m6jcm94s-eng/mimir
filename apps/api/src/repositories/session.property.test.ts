import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { createSession, listSessions } from './session';

describe('tenant isolation (property-style)', () => {
  // This test requires a running Postgres instance.
  // Run it locally with RUN_DB_TESTS=true once the database is migrated.
  it.skipIf(!process.env.RUN_DB_TESTS)('tenant A cannot see tenant B sessions', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    // Seed tenants; RLS requires the SET LOCAL app.tenant_id done by withTenantTransaction.
    await withTenantTransaction(tenantA, async (ctx) => {
      await ctx.tenantScopedDb.insert(schema.tenant).values({ id: tenantA, name: 'Tenant A' });
    });
    await withTenantTransaction(tenantB, async (ctx) => {
      await ctx.tenantScopedDb.insert(schema.tenant).values({ id: tenantB, name: 'Tenant B' });
    });

    const sessionA = await withTenantTransaction(tenantA, async (ctx) => {
      return createSession(ctx, { source: 'web' });
    });

    const sessionsB = await withTenantTransaction(tenantB, async (ctx) => {
      return listSessions(ctx, { limit: 10 });
    });

    expect(sessionsB.data.find((s) => s.id === sessionA.id)).toBeUndefined();
  });
});
