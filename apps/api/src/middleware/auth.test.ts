import { describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resolveAuthUser } from './auth';

describe('resolveAuthUser', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('is idempotent for the same external id', async () => {
    const externalId = `supertokens_idempotent_user_${Date.now()}`;
    const first = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const second = await resolveAuthUser(externalId, `${externalId}@test.local`);

    expect(second.externalId).toBe(first.externalId);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.userId).toBe(first.userId);
    expect(second.role).toBe(first.role);
    expect(second.email).toBe(first.email);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'provisions separate tenants for different external ids',
    async () => {
      const firstExternalId = `supertokens_first_user_${Date.now()}`;
      const secondExternalId = `supertokens_second_user_${Date.now()}`;

      const first = await resolveAuthUser(firstExternalId, `${firstExternalId}@test.local`);
      const second = await resolveAuthUser(secondExternalId, `${secondExternalId}@test.local`);

      expect(first.tenantId).not.toBe(second.tenantId);
      expect(first.userId).not.toBe(second.userId);

      const identities = await db.query.externalIdentity.findMany({
        where: (table, { inArray }) =>
          inArray(table.externalId, [firstExternalId, secondExternalId]),
      });
      expect(identities).toHaveLength(2);
    }
  );
});
