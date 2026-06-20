import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { resolveAuthUser } from '../middleware/auth';
import { hashPin } from '../services/approvals/metadata';
import { buildTestApp } from '../test-helpers/build-app';
import { approvalRoutes } from './approvals';
import { governanceRoutes } from './governance';
import { taskRoutes } from './tasks';

const approvalPolicy = `rules:
  - action: approval.test
    effect: require_approval
    reason: approval required for integration test
  - action: '*'
    effect: allow
`;

describe('approvals routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(approvalRoutes, { prefix: '/v1/approvals' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/approvals',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates a task that is blocked pending approval, then approves it',
    async () => {
      const token = `approvals_approve_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(governanceRoutes, { prefix: '/v1/governance' });
        await app.register(taskRoutes, { prefix: '/v1/tasks' });
        await app.register(approvalRoutes, { prefix: '/v1/approvals' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      await app.inject({
        method: 'PUT',
        url: '/v1/governance/policy',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: approvalPolicy },
      });

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/v1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          idempotencyKey: `approval-test-${Date.now()}`,
          type: 'approval.test',
          prompt: 'summarize this public article',
        },
      });

      expect(taskResponse.statusCode).toBe(202);
      const taskBody = JSON.parse(taskResponse.body);
      expect(taskBody.status).toBe('blocked');
      expect(taskBody.approvalId).toBeDefined();

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/approvals',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toBeInstanceOf(Array);
      expect(listBody.data.some((a: { id: string }) => a.id === taskBody.approvalId)).toBe(true);

      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${taskBody.approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'looks good' },
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.data.status).toBe('approved');
      expect(approveBody.data.decidedBy).toBeDefined();
      expect(approveBody.workflow.workflowId).toBeDefined();
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates a blocked task and denies the approval',
    async () => {
      const token = `approvals_deny_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(governanceRoutes, { prefix: '/v1/governance' });
        await app.register(taskRoutes, { prefix: '/v1/tasks' });
        await app.register(approvalRoutes, { prefix: '/v1/approvals' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      await app.inject({
        method: 'PUT',
        url: '/v1/governance/policy',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: approvalPolicy },
      });

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/v1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          idempotencyKey: `approval-deny-${Date.now()}`,
          type: 'approval.test',
          prompt: 'summarize this public article',
        },
      });

      expect(taskResponse.statusCode).toBe(202);
      const { approvalId } = JSON.parse(taskResponse.body);

      const denyResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approvalId}/deny`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'not approved' },
      });

      expect(denyResponse.statusCode).toBe(200);
      const denyBody = JSON.parse(denyResponse.body);
      expect(denyBody.data.status).toBe('denied');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'enforces the PIN gate when the user has a PIN configured',
    async () => {
      const token = `approvals_pin_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(governanceRoutes, { prefix: '/v1/governance' });
        await app.register(taskRoutes, { prefix: '/v1/tasks' });
        await app.register(approvalRoutes, { prefix: '/v1/approvals' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      await db
        .update(schema.userAccount)
        .set({ pinHash: hashPin('1234') })
        .where(eq(schema.userAccount.id, user.userAccountId));

      await app.inject({
        method: 'PUT',
        url: '/v1/governance/policy',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: approvalPolicy },
      });

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/v1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          idempotencyKey: `approval-pin-${Date.now()}`,
          type: 'approval.test',
          prompt: 'summarize this public article',
        },
      });

      expect(taskResponse.statusCode).toBe(202);
      const { approvalId } = JSON.parse(taskResponse.body);

      const missingPinResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'looks good' },
      });
      expect(missingPinResponse.statusCode).toBe(403);

      const wrongPinResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'looks good', pin: '0000' },
      });
      expect(wrongPinResponse.statusCode).toBe(403);

      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'looks good', pin: '1234' },
      });
      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.data.status).toBe('approved');
    }
  );
});
