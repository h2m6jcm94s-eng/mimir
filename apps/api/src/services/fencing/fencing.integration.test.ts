import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createJob } from '../../repositories/job';
import { StaleEpochError, bumpEpoch, getEpoch, updateJobWithEpochCheck } from './fencing';

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

    const first = await withTenantTransaction(user.tenantId, async (ctx) => bumpEpoch(ctx));
    const second = await withTenantTransaction(user.tenantId, async (ctx) => bumpEpoch(ctx));

    expect(second).toBe(first + 1);

    const current = await withTenantTransaction(user.tenantId, async (ctx) => getEpoch(ctx));
    expect(current).toBe(second);
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

    await withTenantTransaction(user.tenantId, async (ctx) => bumpEpoch(ctx));

    await expect(
      withTenantTransaction(user.tenantId, async (ctx) => {
        return updateJobWithEpochCheck(ctx, job.id, 0, { status: 'running' });
      })
    ).rejects.toThrow(StaleEpochError);
  });
});
