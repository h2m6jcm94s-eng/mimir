import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createJob } from '../repositories/job';
import { buildTestApp } from '../test-helpers/build-app';
import { taskRoutes } from './tasks';

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
});
