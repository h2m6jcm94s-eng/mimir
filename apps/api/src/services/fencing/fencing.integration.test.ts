import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../../db/schema';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createDevice } from '../../repositories/device';
import { createJob } from '../../repositories/job';
import {
  PromotionInProgressError,
  ReadOnlyError,
  StaleEpochError,
  acquirePromotionLease,
  bumpEpoch,
  completePromotion,
  demoteLeader,
  getEpoch,
  updateJobWithEpochCheck,
} from './fencing';

describe('Fencing service', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('starts at epoch 0', async () => {
    const externalId = `fencing_epoch_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const epoch = await withTenantTransaction(user.tenantId, async (ctx) => {
      return getEpoch(ctx);
    });
    expect(epoch).toBe(0);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('bumps epoch monotonically', async () => {
    const externalId = `fencing_bump_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    const first = await withTenantTransaction(user.tenantId, async (ctx) => {
      const current = await getEpoch(ctx);
      const result = await bumpEpoch(ctx, current);
      if (result === null) throw new Error('Unexpected lost epoch bump race');
      return result;
    });
    const second = await withTenantTransaction(user.tenantId, async (ctx) => {
      const current = await getEpoch(ctx);
      const result = await bumpEpoch(ctx, current);
      if (result === null) throw new Error('Unexpected lost epoch bump race');
      return result;
    });

    expect(second).toBe(first + 1);

    const current = await withTenantTransaction(user.tenantId, async (ctx) => getEpoch(ctx));
    expect(current).toBe(second);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('only one concurrent bump wins', async () => {
    const externalId = `fencing_concurrent_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    // Seed a row so every caller has something to update.
    await withTenantTransaction(user.tenantId, async (ctx) => {
      const current = await getEpoch(ctx);
      const result = await bumpEpoch(ctx, current);
      if (result === null) throw new Error('Unexpected lost epoch bump race');
    });

    const baseEpoch = await withTenantTransaction(user.tenantId, async (ctx) => getEpoch(ctx));

    const attempts = Array.from({ length: 5 }, () =>
      withTenantTransaction(user.tenantId, async (ctx) => bumpEpoch(ctx, baseEpoch))
    );
    const results = await Promise.all(attempts);
    const winners = results.filter((r) => r !== null);

    expect(winners).toHaveLength(1);
    expect(winners[0]).toBe(baseEpoch + 1);

    const finalEpoch = await withTenantTransaction(user.tenantId, async (ctx) => getEpoch(ctx));
    expect(finalEpoch).toBe(baseEpoch + 1);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects writes with a stale epoch', async () => {
    const externalId = `fencing_stale_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `fencing-stale-${Date.now()}`,
        type: 'echo',
        tier: 0,
        input: { prompt: 'fencing' },
      });
      return { job: created };
    });

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const current = await getEpoch(ctx);
      const result = await bumpEpoch(ctx, current);
      if (result === null) throw new Error('Unexpected lost epoch bump race');
    });

    await expect(
      withTenantTransaction(user.tenantId, async (ctx) => {
        return updateJobWithEpochCheck(ctx, job.id, 0, { status: 'running' });
      })
    ).rejects.toThrow(StaleEpochError);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('promotion requires a lease and bumps epoch', async () => {
    const externalId = `fencing_promote_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const candidate = await withTenantTransaction(user.tenantId, async (ctx) =>
      createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'brain',
        name: 'candidate',
        tier: 0,
      })
    );
    const candidateNodeId = candidate.id;

    const { epoch, previousEpoch } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const { leaseToken, currentEpoch } = await acquirePromotionLease(ctx, candidateNodeId, 30);
      const epoch = await completePromotion(ctx, candidateNodeId, leaseToken);
      return { epoch, previousEpoch: currentEpoch };
    });

    expect(epoch).toBe(previousEpoch + 1);

    const meta = await withTenantTransaction(user.tenantId, async (ctx) => {
      const [row] = await ctx.tenantScopedDb
        .select()
        .from(schema.meshMeta)
        .where(eq(schema.meshMeta.tenantId, ctx.tenantId));
      return row;
    });
    expect(meta?.leader).toBe(candidateNodeId);
    expect(meta?.transitionState).toBe('active');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'blocks competing promotions when a lease is active',
    async () => {
      const externalId = `fencing_lease_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
      const first = await withTenantTransaction(user.tenantId, async (ctx) =>
        createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: 'brain',
          name: 'first',
          tier: 0,
        })
      );
      const second = await withTenantTransaction(user.tenantId, async (ctx) =>
        createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: 'brain',
          name: 'second',
          tier: 0,
        })
      );
      const firstCandidate = first.id;
      const secondCandidate = second.id;

      const { leaseToken } = await withTenantTransaction(user.tenantId, async (ctx) =>
        acquirePromotionLease(ctx, firstCandidate, 30)
      );

      await expect(
        withTenantTransaction(user.tenantId, async (ctx) =>
          acquirePromotionLease(ctx, secondCandidate, 30)
        )
      ).rejects.toThrow(PromotionInProgressError);

      // Completing the first promotion releases the lease.
      await withTenantTransaction(user.tenantId, async (ctx) =>
        completePromotion(ctx, firstCandidate, leaseToken)
      );
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('demotion makes the leader read-only', async () => {
    const externalId = `fencing_demote_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const candidate = await withTenantTransaction(user.tenantId, async (ctx) =>
      createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'brain',
        name: 'candidate',
        tier: 0,
      })
    );
    const candidateNodeId = candidate.id;

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const { leaseToken } = await acquirePromotionLease(ctx, candidateNodeId, 30);
      await completePromotion(ctx, candidateNodeId, leaseToken);
    });

    const result = await withTenantTransaction(user.tenantId, async (ctx) =>
      demoteLeader(ctx, candidateNodeId)
    );
    expect(result.demoted).toBe(true);

    await expect(
      withTenantTransaction(user.tenantId, async (ctx) => {
        return updateJobWithEpochCheck(ctx, 'does-not-matter', result.epoch, { status: 'running' });
      })
    ).rejects.toThrow(ReadOnlyError);
  });
});
