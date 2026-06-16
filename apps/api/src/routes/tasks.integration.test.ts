import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { authMiddleware, registerAuth, resolveAuthUser } from '../middleware/auth';
import { createJob } from '../repositories/job';
import { taskRoutes } from './tasks';

describe('tasks routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = Fastify();
    await registerAuth(app);
    app.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith('/v1/')) {
        await authMiddleware(request, reply);
      }
    });
    app.register(taskRoutes, { prefix: '/v1/tasks' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('lists jobs for the tenant', async () => {
    const user = await resolveAuthUser('test');
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `tasks-list-test-${Date.now()}`,
        type: 'test-task',
        tier: 1,
        input: { prompt: 'integration test' },
      });
      return { job: created };
    });

    const app = Fastify();
    await registerAuth(app);
    app.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith('/v1/')) {
        await authMiddleware(request, reply);
      }
    });
    app.register(taskRoutes, { prefix: '/v1/tasks' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks?limit=10',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((j: { id: string }) => j.id === job.id)).toBe(true);
  });
});
