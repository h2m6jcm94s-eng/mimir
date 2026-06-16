import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TenantContext } from '../db/tenant-context';
import { createSession, listSessions } from './session';

describe('tenant isolation (property-style)', () => {
  // This test requires a running Postgres instance and seeded tenants.
  // Run it locally with RUN_DB_TESTS=true once fixtures are in place.
  it.skipIf(!process.env.RUN_DB_TESTS)('tenant A cannot see tenant B sessions', async () => {
    const ctxA = new TenantContext(randomUUID());
    const ctxB = new TenantContext(randomUUID());

    const sessionA = await createSession(ctxA, { source: 'web' });
    const sessionsB = await listSessions(ctxB, { limit: 10 });

    expect(sessionsB.data.find((s) => s.id === sessionA.id)).toBeUndefined();
  });
});
