import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { withTenantTransaction } from '../../db/tenant-context';
import { executeLibSqlWrite } from './lifecycle';

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function syncJobsToLibSql(tenantId: string, limit = 1000): Promise<number> {
  const postgresJobs = await withTenantTransaction(tenantId, async (ctx) => {
    return ctx.tenantScopedDb.select().from(schema.job).limit(limit);
  });

  for (const job of postgresJobs) {
    await executeLibSqlWrite(
      {
        sql: `
          INSERT INTO job (
            id, tenant_id, workflow_id, run_id, idempotency_key, type, tier, status,
            input, result, epoch, checkpoint, cost_usd, priority, retry_count, max_retries,
            started_at, finished_at, error_code, error_message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            workflow_id = excluded.workflow_id,
            run_id = excluded.run_id,
            status = excluded.status,
            input = excluded.input,
            result = excluded.result,
            epoch = excluded.epoch,
            checkpoint = excluded.checkpoint,
            cost_usd = excluded.cost_usd,
            priority = excluded.priority,
            retry_count = excluded.retry_count,
            max_retries = excluded.max_retries,
            started_at = excluded.started_at,
            finished_at = excluded.finished_at,
            error_code = excluded.error_code,
            error_message = excluded.error_message
        `,
        args: [
          job.id,
          serialize(job.tenantId),
          serialize(job.workflowId),
          serialize(job.runId),
          serialize(job.idempotencyKey),
          serialize(job.type),
          job.tier,
          serialize(job.status),
          serialize(job.input),
          serialize(job.result),
          job.epoch,
          serialize(job.checkpoint),
          job.costUsd,
          job.priority,
          job.retryCount,
          job.maxRetries,
          serialize(job.startedAt),
          serialize(job.finishedAt),
          serialize(job.errorCode),
          serialize(job.errorMessage),
          serialize(job.createdAt),
        ],
      },
      'syncJobsToLibSql'
    );
  }

  return postgresJobs.length;
}

export async function syncNodesToLibSql(tenantId: string, limit = 1000): Promise<number> {
  const postgresNodes = await withTenantTransaction(tenantId, async (ctx) => {
    return ctx.tenantScopedDb.select().from(schema.node).limit(limit);
  });

  for (const node of postgresNodes) {
    await executeLibSqlWrite(
      {
        sql: `
          INSERT INTO node (
            id, tenant_id, owner_user_account_id, kind, name, tier, tailnet_addr,
            public_key, api_key_hash, status, last_seen, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind,
            name = excluded.name,
            tier = excluded.tier,
            tailnet_addr = excluded.tailnet_addr,
            public_key = excluded.public_key,
            api_key_hash = excluded.api_key_hash,
            status = excluded.status,
            last_seen = excluded.last_seen
        `,
        args: [
          node.id,
          serialize(node.tenantId),
          serialize(node.ownerUserAccountId),
          serialize(node.kind),
          serialize(node.name),
          node.tier,
          serialize(node.tailnetAddr),
          serialize(node.publicKey),
          serialize(node.apiKeyHash),
          serialize(node.status),
          serialize(node.lastSeen),
          serialize(node.createdAt),
        ],
      },
      'syncNodesToLibSql'
    );
  }

  return postgresNodes.length;
}

async function writeReplicaWatermark(tenantId: string): Promise<void> {
  const syncStartedAt = new Date();

  const epoch = await withTenantTransaction(tenantId, async (ctx) => {
    const [meta] = await ctx.tenantScopedDb
      .select({ epoch: schema.meshMeta.epoch })
      .from(schema.meshMeta)
      .where(eq(schema.meshMeta.tenantId, tenantId));
    return meta?.epoch ?? 0;
  });

  const syncFinishedAt = new Date();
  const lagMs = syncFinishedAt.getTime() - syncStartedAt.getTime();

  await executeLibSqlWrite(
    {
      sql: `
        INSERT INTO replica_watermark (tenant_id, last_sync_at, last_synced_epoch, lag_ms)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          last_sync_at = excluded.last_sync_at,
          last_synced_epoch = excluded.last_synced_epoch,
          lag_ms = excluded.lag_ms
      `,
      args: [tenantId, syncFinishedAt.toISOString(), epoch, lagMs],
    },
    'writeReplicaWatermark'
  );
}

export async function syncStateToLibSql(
  tenantId: string
): Promise<{ jobs: number; nodes: number; lagMs: number }> {
  const syncStartedAt = Date.now();
  const [jobs, nodes] = await Promise.all([
    syncJobsToLibSql(tenantId),
    syncNodesToLibSql(tenantId),
  ]);
  await writeReplicaWatermark(tenantId);
  return { jobs, nodes, lagMs: Date.now() - syncStartedAt };
}

const pendingSyncs = new Set<string>();

export function scheduleSync(tenantId: string): void {
  // Continuous background sync is disabled in unit/integration tests to avoid
  // SQLite lock contention on the shared local replica file.
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;
  if (pendingSyncs.has(tenantId)) return;
  pendingSyncs.add(tenantId);
  setImmediate(async () => {
    pendingSyncs.delete(tenantId);
    try {
      await syncStateToLibSql(tenantId);
    } catch (err) {
      // Non-fatal: continuous sync should not break request paths.
      // eslint-disable-next-line no-console
      console.warn(`Scheduled LibSQL sync failed for tenant ${tenantId}`, err);
    }
  });
}
