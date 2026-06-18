import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createDevice } from '../repositories/device';
import { buildTestApp } from '../test-helpers/build-app';
import { nodeRoutes } from './nodes';

describe('nodes routes', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('returns a node by id', async () => {
    const externalId = `nodes_get_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { device } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'brain',
        name: 'test-brain',
        tier: 0,
      });
      return { device: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(nodeRoutes, { prefix: '/v1/nodes' });
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/nodes/${device.id}`,
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(device.id);
    expect(body.name).toBe('test-brain');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('updates last_seen on heartbeat', async () => {
    const externalId = `nodes_hb_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { device } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'desktop',
        name: 'test-desktop',
        tier: 1,
      });
      return { device: created };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(nodeRoutes, { prefix: '/v1/nodes' });
    });

    const before = await app.inject({
      method: 'GET',
      url: `/v1/nodes/${device.id}`,
      headers: { authorization: `Bearer ${externalId}` },
    });
    const beforeBody = JSON.parse(before.body);
    const beforeLastSeen = beforeBody.lastSeen;

    const heartbeat = await app.inject({
      method: 'POST',
      url: `/v1/nodes/${device.id}/heartbeat`,
      headers: { authorization: `Bearer ${externalId}` },
      payload: { status: 'up' },
    });

    expect(heartbeat.statusCode).toBe(200);
    const heartbeatBody = JSON.parse(heartbeat.body);
    expect(heartbeatBody.status).toBe('up');
    expect(heartbeatBody.lastSeen).not.toBe(beforeLastSeen);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 for heartbeat on missing node', async () => {
    const externalId = `nodes_hb_missing_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(nodeRoutes, { prefix: '/v1/nodes' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes/00000000-0000-0000-0000-000000000000/heartbeat',
      headers: { authorization: `Bearer ${externalId}` },
      payload: { status: 'up' },
    });

    expect(response.statusCode).toBe(404);
  });
});
