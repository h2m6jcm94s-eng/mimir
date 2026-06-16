import { describe, expect, it } from 'vitest';
import { TenantContext } from '../db/tenant-context';
import { createJob, getJob } from '../repositories/job';
import { applyPatch, build, review } from './activities';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000000';

describe('Temporal activities (integration)', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)(
    'build is idempotent when checkpoint already contains a build result',
    async () => {
      const ctx = new TenantContext(TEST_TENANT_ID);
      const job = await createJob(ctx, {
        idempotencyKey: `replay-test-${Date.now()}`,
        type: 'echo',
        tier: 0,
        input: { prompt: 'hello' },
      });

      const input = {
        tenantId: TEST_TENANT_ID,
        userId: TEST_TENANT_ID,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        tier: job.tier,
        payload: {},
      };

      const first = await build(input);
      const afterFirst = await getJob(ctx, job.id);
      const firstFinishedAt = (afterFirst?.checkpoint as { build?: { finishedAt: string } }).build?.finishedAt;

      const second = await build(input);
      const afterSecond = await getJob(ctx, job.id);
      const secondFinishedAt = (afterSecond?.checkpoint as { build?: { finishedAt: string } }).build?.finishedAt;

      expect(second).toEqual(first);
      expect(secondFinishedAt).toBe(firstFinishedAt);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'review is idempotent when checkpoint already contains a review for the iteration',
    async () => {
      const ctx = new TenantContext(TEST_TENANT_ID);
      const job = await createJob(ctx, {
        idempotencyKey: `review-replay-test-${Date.now()}`,
        type: 'revise-once',
        tier: 0,
        input: { prompt: 'hello' },
      });

      const input = {
        tenantId: TEST_TENANT_ID,
        userId: TEST_TENANT_ID,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        tier: job.tier,
        payload: {},
      };

      const buildResult = await build(input);
      const first = await review(input, buildResult, 0);
      const second = await review(input, buildResult, 0);

      expect(second).toEqual(first);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'applyPatch updates the checkpoint with a new draft',
    async () => {
      const ctx = new TenantContext(TEST_TENANT_ID);
      const job = await createJob(ctx, {
        idempotencyKey: `patch-test-${Date.now()}`,
        type: 'echo',
        tier: 0,
        input: { prompt: 'hello' },
      });

      const input = {
        tenantId: TEST_TENANT_ID,
        userId: TEST_TENANT_ID,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        tier: job.tier,
        payload: {},
      };

      const buildResult = await build(input);
      const reviewResult = await review(input, buildResult, 0);
      if (!reviewResult.patch) {
        throw new Error('Expected a patch for revise-once');
      }

      const patched = await applyPatch(input, buildResult, reviewResult, 0);
      expect(patched.artifacts).toMatchObject({ revised: true });

      const afterPatch = await getJob(ctx, job.id);
      const patches = (afterPatch?.checkpoint as { patches?: unknown[] }).patches;
      expect(patches).toHaveLength(1);
    }
  );
});
