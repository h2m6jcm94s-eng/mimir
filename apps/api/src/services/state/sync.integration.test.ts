import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createDevice } from '../../repositories/device';
import { createJob } from '../../repositories/job';
import { initializeLibSqlSchema } from './libsql-schema';
import { getReplicaJob, getReplicaWatermark, listReplicaJobsByTenant } from './read';
import { syncStateToLibSql } from './sync';

describe('LibSQL state store sync', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('replicates a job from Postgres to LibSQL', async () => {
    await initializeLibSqlSchema();

    const externalId = `libsql_sync_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createJob(ctx, {
        idempotencyKey: `libsql-test-${Date.now()}`,
        type: 'echo',
        tier: 0,
        input: { prompt: 'libsql sync test' },
      });
      return { job: created };
    });

    const result = await syncStateToLibSql(user.tenantId);

    const replica = await getReplicaJob(job.id);
    expect(replica).toBeDefined();
    expect(replica?.tenant_id).toBe(user.tenantId);
    expect(replica?.status).toBe('queued');
    expect(replica?.type).toBe('echo');

    const list = await listReplicaJobsByTenant(user.tenantId);
    expect(list.some((j) => j.id === job.id)).toBe(true);

    const watermark = await getReplicaWatermark(user.tenantId);
    expect(watermark).toBeDefined();
    expect(watermark?.last_synced_epoch).toBeGreaterThanOrEqual(0);
    expect(result.lagMs).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('replicates a node from Postgres to LibSQL', async () => {
    await initializeLibSqlSchema();

    const externalId = `libsql_node_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const { device } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const created = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'cloud',
        name: 'libsql-cloud',
        tier: 2,
      });
      return { device: created };
    });

    await syncStateToLibSql(user.tenantId);

    const client = (await import('../../db/libsql.js')).getLibSqlClient();
    const result = await client.execute({
      sql: 'SELECT id, tenant_id, name, kind, status FROM node WHERE id = ?',
      args: [device.id],
    });

    expect(result.rows.length).toBe(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row.id).toBe(device.id);
    expect(row.tenant_id).toBe(user.tenantId);
    expect(row.name).toBe('libsql-cloud');
  });
});
