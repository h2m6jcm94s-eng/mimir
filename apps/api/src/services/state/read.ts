import { getLibSqlClient } from '../../db/libsql';

export interface ReplicaJob {
  id: string;
  tenant_id: string;
  status: string;
  type: string;
  tier: number;
  cost_usd: number;
  created_at: string;
}

export interface ReplicaWatermark {
  tenant_id: string;
  last_sync_at: string;
  last_synced_epoch: number;
  lag_ms: number | null;
}

export async function getReplicaJob(jobId: string): Promise<ReplicaJob | undefined> {
  const client = getLibSqlClient();
  const result = await client.execute({
    sql: 'SELECT id, tenant_id, status, type, tier, cost_usd, created_at FROM job WHERE id = ?',
    args: [jobId],
  });
  return result.rows[0] ? (result.rows[0] as unknown as ReplicaJob) : undefined;
}

export async function listReplicaJobsByTenant(
  tenantId: string,
  limit = 100
): Promise<ReplicaJob[]> {
  const client = getLibSqlClient();
  const result = await client.execute({
    sql: 'SELECT id, tenant_id, status, type, tier, cost_usd, created_at FROM job WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [tenantId, limit],
  });
  return result.rows as unknown as ReplicaJob[];
}

export async function getReplicaWatermark(tenantId: string): Promise<ReplicaWatermark | undefined> {
  const client = getLibSqlClient();
  const result = await client.execute({
    sql: 'SELECT tenant_id, last_sync_at, last_synced_epoch, lag_ms FROM replica_watermark WHERE tenant_id = ?',
    args: [tenantId],
  });
  return result.rows[0] ? (result.rows[0] as unknown as ReplicaWatermark) : undefined;
}

export async function getOldestReplicaLagMs(): Promise<number | null> {
  const client = getLibSqlClient();
  try {
    const result = await client.execute({
      sql: `SELECT COALESCE(
        (SELECT CAST((julianday('now') - julianday(last_sync_at)) * 86400000 AS INTEGER)
         FROM replica_watermark ORDER BY last_sync_at ASC LIMIT 1),
        -1
      ) as lag_ms`,
      args: [],
    });
    const lag = result.rows[0]?.lag_ms;
    return typeof lag === 'number' ? lag : null;
  } catch {
    return null;
  }
}

export async function checkLibSql(): Promise<'ok' | 'error'> {
  try {
    const client = getLibSqlClient();
    await client.execute('SELECT 1');
    return 'ok';
  } catch (err) {
    console.error('LibSQL health check failed:', err);
    return 'error';
  }
}
