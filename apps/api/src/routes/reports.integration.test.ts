import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createApproval } from '../repositories/approval';
import { createJob } from '../repositories/job';
import { createReport } from '../repositories/report';
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

  it.skipIf(!process.env.RUN_DB_TESTS)('lists, searches, and creates reports', async () => {
    const externalId = `reports_catalog_user_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      await createReport(ctx, {
        tenantId: user.tenantId,
        title: 'Security Audit',
        description: 'CVE scan and access review.',
        kind: 'security',
        status: 'ready',
      });
      await createReport(ctx, {
        tenantId: user.tenantId,
        title: 'Weekly Cost Report',
        description: 'Token spend by model and tier.',
        kind: 'cost',
        status: 'ready',
      });
    });

    const app = await buildTestApp(async (app) => {
      await app.register(reportRoutes, { prefix: '/v1/reports' });
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${externalId}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toHaveLength(2);

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/v1/reports?q=security&kind=security',
      headers: { authorization: `Bearer ${externalId}` },
    });
    expect(searchResponse.statusCode).toBe(200);
    const searchBody = JSON.parse(searchResponse.body);
    expect(searchBody.data).toHaveLength(1);
    expect(searchBody.data[0].title).toBe('Security Audit');

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Q2 Compliance Summary',
        description: 'Governance log attestations.',
        kind: 'compliance',
        status: 'scheduled',
      }),
    });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.title).toBe('Q2 Compliance Summary');
  });
});
