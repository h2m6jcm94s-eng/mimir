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
