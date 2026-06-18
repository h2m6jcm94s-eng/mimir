import { describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createJob, updateJobStatus } from '../repositories/job';
import { publishJobEvent } from '../services/events/publisher';
import { buildTestApp } from '../test-helpers/build-app';
import { taskRoutes } from './tasks';

vi.mock('../temporal/client', () => ({
  startTaskWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-test', runId: 'run-test' }),
  terminateWorkflow: vi.fn().mockResolvedValue(undefined),
}));

describe('tasks events routes', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('lists persisted job lifecycle events', async () => {
    process.env.EVENT_BUS_ENABLED = 'false';
    const externalId = `tasks_events_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job, event } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-events-test-${Date.now()}`,
        type: 'echo',
        tier: 0,
        input: { prompt: 'integration test' },
      });
      await updateJobStatus(ctx, created.id, 'running');
      const evt = await publishJobEvent(ctx, {
        jobId: created.id,
        type: 'job.running',
        payload: { step: 'build' },
      });
      return { job: created, event: evt };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(taskRoutes, { prefix: '/v1/tasks' });
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/tasks/${job.id}/events?limit=10`,
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.some((e: { id: string }) => e.id === event.id)).toBe(true);
    expect(body.data.some((e: { type: string }) => e.type === 'job.running')).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'returns 404 for a job belonging to another tenant',
    async () => {
      const externalIdA = `tasks_events_a_${Date.now()}`;
      const userA = await resolveAuthUser(externalIdA, `${externalIdA}@test.local`);
      const externalIdB = `tasks_events_b_${Date.now()}`;
      const userB = await resolveAuthUser(externalIdB, `${externalIdB}@test.local`);

      const { job } = await withTenantTransaction(userA.tenantId, async (ctx) => {
        const created = await createJob(ctx, {
          idempotencyKey: `tasks-events-isolation-${Date.now()}`,
          type: 'echo',
          tier: 0,
          input: { prompt: 'integration test' },
        });
        return { job: created };
      });

      const app = await buildTestApp(async (app) => {
        await app.register(taskRoutes, { prefix: '/v1/tasks' });
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/tasks/${job.id}/events?limit=10`,
        headers: { authorization: `Bearer ${externalIdB}` },
      });

      expect(response.statusCode).toBe(404);
    }
  );
});
