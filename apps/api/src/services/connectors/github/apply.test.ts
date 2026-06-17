import { describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../../../db/tenant-context';
import { resolveAuthUser } from '../../../middleware/auth';
import { createConnector } from '../../../repositories/connector';
import { githubOpenPrHandler } from './apply';

describe('githubOpenPrHandler', () => {
  it('does not open a PR when review is not approved', async () => {
    const user = await resolveAuthUser('apply_unapproved', 'apply_unapproved@test.local');
    await withTenantTransaction(user.tenantId, async (ctx) => {
      const result = await githubOpenPrHandler(
        ctx,
        {
          tenantId: ctx.tenantId,
          userId: 'user',
          jobId: 'job',
          idempotencyKey: 'key',
          type: 'github.openPr',
          tier: 1,
          payload: { owner: 'acme', repo: 'app', title: 'x', body: '', head: 'f', base: 'm' },
        },
        { success: true, artifacts: {}, log: [] },
        { approved: false }
      );
      expect(result.applied).toBe(false);
      expect(result.reason).toContain('Review did not approve');
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'opens a PR when reviewed and connector exists',
    async () => {
      const token = `apply_openpr_${Date.now()}`;
      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_GITHUB_${user.tenantId}`] = 'test-token';

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createConnector(ctx, {
          kind: 'github',
          secretRef: 'github',
          tier: 1,
          status: 'connected',
        });
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ number: 42, html_url: 'https://github.com/acme/app/pull/42' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return githubOpenPrHandler(
          ctx,
          {
            tenantId: ctx.tenantId,
            userId: 'user',
            jobId: 'job',
            idempotencyKey: 'key',
            type: 'github.openPr',
            tier: 1,
            payload: {
              owner: 'acme',
              repo: 'app',
              title: 'Fix bug',
              body: 'Details',
              head: 'feature',
              base: 'main',
            },
          },
          { success: true, artifacts: {}, log: [] },
          { approved: true }
        );
      });

      expect(result.applied).toBe(true);
      expect(result.output).toEqual({ number: 42, url: 'https://github.com/acme/app/pull/42' });
    }
  );
});
