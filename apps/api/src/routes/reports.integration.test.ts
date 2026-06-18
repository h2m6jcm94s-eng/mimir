import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createApproval } from '../repositories/approval';
import { createJob } from '../repositories/job';
import { buildTestApp } from '../test-helpers/build-app';
import { reportRoutes } from './reports';

describe('reports routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(reportRoutes, { prefix: '/v1/reports' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/reports/ceo',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'returns a ceo report with task health, burn, risk, and decisions',
    async () => {
      const externalId = `reports_ceo_user_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

      await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await createJob(ctx, {
          idempotencyKey: `ceo-report-fail-${Date.now()}`,
          type: 'test-task',
          tier: 1,
          input: { prompt: 'test' },
        });
        await createApproval(ctx, {
          jobId: job.id,
          requestedBy: user.userId,
          reason: 'needs human review',
        });
      });

      const app = await buildTestApp(async (app) => {
        await app.register(reportRoutes, { prefix: '/v1/reports' });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/ceo',
        headers: { authorization: `Bearer ${externalId}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.generatedAt).toBeDefined();
      expect(body.taskHealth).toBeDefined();
      expect(body.taskHealth.byStatus).toBeInstanceOf(Object);
      expect(body.burn).toBeDefined();
      expect(typeof body.burn.dailySpendUsd).toBe('number');
      expect(body.risk).toBeDefined();
      expect(body.risk.halted).toBe(false);
      expect(body.decisions.pendingApprovalsCount).toBeGreaterThan(0);
      expect(body.usageInsights).toBeDefined();
      expect(typeof body.usageInsights.timeSavedMinutes).toBe('number');
      expect(typeof body.usageInsights.automationRate).toBe('number');
    }
  );
});
