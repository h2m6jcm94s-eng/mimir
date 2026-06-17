import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createConnector } from '../../repositories/connector';
import { connectorRegistry } from './registry';

describe('ConnectorRegistry', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)(
    'rejects actions when request tier is more private than connector tier',
    async () => {
      const token = `registry_tier_${Date.now()}`;
      const user = await resolveAuthUser(token, `${token}@test.local`);

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createConnector(ctx, { kind: 'github', secretRef: 'github', tier: 1 });
      });

      await expect(
        withTenantTransaction(user.tenantId, async (ctx) => {
          return connectorRegistry.runAction(ctx, {
            tenantId: user.tenantId,
            kind: 'github',
            action: 'listRepos',
            input: {},
            requestTier: 0,
            actor: 'user',
          });
        })
      ).rejects.toThrow('TIER_VIOLATION');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects unknown actions', async () => {
    const token = `registry_action_${Date.now()}`;
    const user = await resolveAuthUser(token, `${token}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      await createConnector(ctx, { kind: 'github', secretRef: 'github', tier: 1 });
    });

    await expect(
      withTenantTransaction(user.tenantId, async (ctx) => {
        return connectorRegistry.runAction(ctx, {
          tenantId: user.tenantId,
          kind: 'github',
          action: 'unknownAction',
          input: {},
          requestTier: 1,
          actor: 'user',
        });
      })
    ).rejects.toThrow('Unknown action');
  });
});
