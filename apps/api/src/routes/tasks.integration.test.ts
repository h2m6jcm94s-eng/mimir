import { describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createJob, updateJobStatus } from '../repositories/job';
import { buildTestApp } from '../test-helpers/build-app';
import { taskRoutes } from './tasks';

vi.mock('../temporal/client', () => ({
  startTaskWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-test', runId: 'run-test' }),
  terminateWorkflow: vi.fn().mockResolvedValue(undefined),
}));

describe('tasks routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('lists jobs for the tenant', async () => {
    const externalId = `tasks_user_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-list-test-${Date.now()}`,
        type: 'test-task',
        tier: 1,
        input: { prompt: 'integration test' },
      });
      return { job: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks?limit=10',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((j: { id: string }) => j.id === job.id)).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('filters jobs by status and type', async () => {
    const externalId = `tasks_filter_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { runningJob } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const running = await createJob(ctx, {
        idempotencyKey: `tasks-filter-running-${Date.now()}`,
        type: 'filter-task',
        tier: 1,
        input: { prompt: 'running' },
      });
      await updateJobStatus(ctx, running.id, 'running');
      return { runningJob: running };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks?status=running&type=filter-task&limit=10',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(runningJob.id);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns counts grouped by status', async () => {
    const externalId = `tasks_counts_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    await withTenantTransaction(user.tenantId, async (ctx) => {
      const running = await createJob(ctx, {
        idempotencyKey: `tasks-counts-running-${Date.now()}`,
        type: 'count-task',
        tier: 1,
        input: { prompt: 'running' },
      });
      await updateJobStatus(ctx, running.id, 'running');
      const blocked = await createJob(ctx, {
        idempotencyKey: `tasks-counts-blocked-${Date.now()}`,
        type: 'count-task',
        tier: 1,
        input: { prompt: 'blocked' },
      });
      await updateJobStatus(ctx, blocked.id, 'blocked');
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks/counts',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.counts.running).toBeGreaterThanOrEqual(1);
    expect(body.counts.blocked).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('updates job status with a valid transition', async () => {
    const externalId = `tasks_status_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-status-${Date.now()}`,
        type: 'status-task',
        tier: 1,
        input: { prompt: 'status' },
      });
      return { job: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/tasks/${job.id}/status`,
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ status: 'blocked', reason: 'paused for review' }),
    });

    expect(patchResponse.statusCode).toBe(200);
    const patched = JSON.parse(patchResponse.body);
    expect(patched.status).toBe('blocked');

    const invalidResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/tasks/${job.id}/status`,
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ status: 'done' }),
    });

    expect(invalidResponse.statusCode).toBe(409);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('cancels a queued job', async () => {
    const externalId = `tasks_cancel_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-cancel-${Date.now()}`,
        type: 'cancel-task',
        tier: 1,
        input: { prompt: 'cancel me' },
      });
      return { job: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/tasks/${job.id}/cancel`,
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('failed');
    expect(body.errorCode).toBe('cancelled');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('retries a failed job', async () => {
    const externalId = `tasks_retry_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-retry-${Date.now()}`,
        type: 'retry-task',
        tier: 1,
        input: { prompt: 'retry me' },
      });
      await updateJobStatus(ctx, created.id, 'failed', {
        retryCount: 1,
        errorCode: 'test_error',
        errorMessage: 'test failure',
      });
      return { job: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/tasks/${job.id}/retry`,
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('queued');

    const refreshed = await app.inject({
      method: 'GET',
      url: `/v1/tasks/${job.id}`,
      headers: { authorization: `Bearer ${externalId}` },
    });
    const refreshedBody = JSON.parse(refreshed.body);
    expect(refreshedBody.retryCount).toBe(2);
    expect(refreshedBody.errorCode).toBeNull();
  });
});
