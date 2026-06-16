import { describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resolveAuthUser, setTokenVerifier } from './auth';

const makeVerifier = (sub: string) => async (token: string) => {
  if (!token) throw new Error('Missing token');
  return { sub };
};

describe('resolveAuthUser', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('is idempotent for the same clerk sub', async () => {
    setTokenVerifier(makeVerifier('clerk_idempotent_user'));

    const first = await resolveAuthUser('token-1');
    const second = await resolveAuthUser('token-2');

    expect(second.clerkId).toBe(first.clerkId);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.userId).toBe(first.userId);
    expect(second.role).toBe(first.role);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'provisions separate tenants for different clerk subs',
    async () => {
      setTokenVerifier(makeVerifier('clerk_first_user'));
      const first = await resolveAuthUser('token-a');

      setTokenVerifier(makeVerifier('clerk_second_user'));
      const second = await resolveAuthUser('token-b');

      expect(first.tenantId).not.toBe(second.tenantId);
      expect(first.userId).not.toBe(second.userId);

      // Verify rows exist in the lookup table.
      const rows = await db.query.authIdentity.findMany({
        where: (table, { inArray }) =>
          inArray(table.clerkId, ['clerk_first_user', 'clerk_second_user']),
      });
      expect(rows).toHaveLength(2);
    }
  );
});
