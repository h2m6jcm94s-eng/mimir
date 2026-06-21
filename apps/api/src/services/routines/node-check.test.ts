import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createDevice } from '../../repositories/device';
import { updateNodeHeartbeat } from '../../repositories/node';
import { NodeUnavailableError, assertNodeAvailable } from './node-check';

describe('assertNodeAvailable', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('allows routines with no assigned node', async () => {
    const externalId = `node_check_none_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const node = await assertNodeAvailable(ctx, undefined);
      expect(node).toBeUndefined();
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('allows an up node', async () => {
    const externalId = `node_check_up_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const device = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'desktop',
        name: 'Desktop up',
        tier: 1,
      });

      const node = await assertNodeAvailable(ctx, device.id);
      expect(node).toMatchObject({ id: device.id, status: 'up' });
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects a down node', async () => {
    const externalId = `node_check_down_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const device = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'desktop',
        name: 'Desktop down',
        tier: 1,
      });
      await updateNodeHeartbeat(ctx, device.id, 'down');

      await expect(assertNodeAvailable(ctx, device.id)).rejects.toBeInstanceOf(
        NodeUnavailableError
      );
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects an unknown node', async () => {
    const externalId = `node_check_missing_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      await expect(
        assertNodeAvailable(ctx, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NodeUnavailableError);
    });
  });
});
