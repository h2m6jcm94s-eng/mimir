import { describe, expect, it, beforeAll } from 'vitest';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { createJob, getJob } from '../repositories/job';
import { applyPatch, build, review } from './activities';
import type { TaskRunInput } from './workflows';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000000';

async function createTestJob(idempotencyKey: string, type: string, tier: number) {
  return withTenantTransaction(TEST_TENANT_ID, async (ctx) => {
    return createJob(ctx, {
      idempotencyKey,
      type,
      tier,
      input: { prompt: 'hello' },
    });
  });
}

describe('Temporal activities (integration)', () => {
  beforeAll(async () => {
    await withTenantTransaction(TEST_TENANT_ID, async (ctx) => {
      await ctx.tenantScopedDb
        .insert(schema.tenant)
        .values({ id: TEST_TENANT_ID, name: 'Test tenant', plan: 'free' })
        .onConflictDoNothing();
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'build is idempotent when checkpoint already contains a build result',
    async () => {
      const job = await createTestJob(`replay-test-${Date.now()}`, 'echo', 0);

      const input: TaskRunInput = {
        tenantId: TEST_TENANT_ID,
        userId: TEST_TENANT_ID,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        tier: job.tier,
        source: 'api',
        payload: {},
      };

      const first = await build(input);
      const afterFirst = await withTenantTransaction(TEST_TENANT_ID, async (ctx) => {
        return getJob(ctx, job.id);
      });
      const firstFinishedAt = (afterFirst?.checkpoint as { build?: { finishedAt: string } }).build
        ?.finishedAt;

      const second = await build(input);
      const afterSecond = await withTenantTransaction(TEST_TENANT_ID, async (ctx) => {
        return getJob(ctx, job.id);
      });
      const secondFinishedAt = (afterSecond?.checkpoint as { build?: { finishedAt: string } }).build
        ?.finishedAt;

      expect(second).toEqual(first);
      expect(secondFinishedAt).toBe(firstFinishedAt);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'review is idempotent when checkpoint already contains a review for the iteration',
    async () => {
      const job = await createTestJob(`review-replay-test-${Date.now()}`, 'revise-once', 0);

      const input: TaskRunInput = {
        tenantId: TEST_TENANT_ID,
        userId: TEST_TENANT_ID,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        tier: job.tier,
        source: 'api',
        payload: {},
      };

      const buildResult = await build(input);
      const first = await review(input, buildResult, 0);
      const second = await review(input, buildResult, 0);

      expect(second).toEqual(first);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('applyPatch updates the checkpoint with a new draft', async () => {
    const job = await createTestJob(`patch-test-${Date.now()}`, 'revise-once', 0);

    const input: TaskRunInput = {
      tenantId: TEST_TENANT_ID,
      userId: TEST_TENANT_ID,
      jobId: job.id,
      idempotencyKey: job.idempotencyKey,
      type: job.type,
      tier: job.tier,
      source: 'api',
      payload: {},
    };

    const buildResult = await build(input);
    const reviewResult = await review(input, buildResult, 0);
    if (!reviewResult.patch) {
      throw new Error('Expected a patch for revise-once');
    }

    const patched = await applyPatch(input, buildResult, reviewResult, 0);
    expect(patched.artifacts).toMatchObject({ revised: true });

    const afterPatch = await withTenantTransaction(TEST_TENANT_ID, async (ctx) => {
      return getJob(ctx, job.id);
    });
    const patches = (afterPatch?.checkpoint as { patches?: unknown[] }).patches;
    expect(patches).toHaveLength(1);
  });
});
