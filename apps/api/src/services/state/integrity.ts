import { getLibSqlClient } from '../../db/libsql';
import { computeHash, computePostgresChecksum, updateExpectedChecksum } from './checksum';
import { executeLibSqlWrite } from './lifecycle';
import { syncStateToLibSql } from './sync';

export interface IntegrityResult {
  ok: boolean;
  integrityCheck: string;
  checksumMatch: boolean;
  expectedHash: string | null;
  actualHash: string | null;
}

export interface GlobalIntegrityResult {
  ok: boolean;
  databaseIntegrity: string;
  tenants: { tenantId: string; ok: boolean; checksumMatch: boolean }[];
}

export function getIntegrityIntervalMs(): number {
  const raw = process.env.LIBSQL_INTEGRITY_INTERVAL_MS;
  if (!raw) return 60 * 60 * 1000; // 1 hour
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 60_000) return 60 * 60 * 1000;
  return parsed;
}

export async function computeReplicaChecksum(tenantId: string): Promise<string> {
  const client = getLibSqlClient();
  const [jobs, nodes] = await Promise.all([
    client.execute({
      sql: 'SELECT * FROM job WHERE tenant_id = ? ORDER BY id',
      args: [tenantId],
    }),
    client.execute({
      sql: 'SELECT * FROM node WHERE tenant_id = ? ORDER BY id',
      args: [tenantId],
    }),
  ]);
  return computeHash([
    ...(jobs.rows as Record<string, unknown>[]),
    ...(nodes.rows as Record<string, unknown>[]),
  ]);
}

export async function runIntegrityCheck(): Promise<string> {
  const client = getLibSqlClient();
  const result = await client.execute('PRAGMA integrity_check;');
  const value = result.rows[0]?.integrity_check;
  return typeof value === 'string' ? value : 'unknown';
}

export async function getExpectedChecksum(tenantId: string): Promise<string | null> {
  const client = getLibSqlClient();
  const result = await client.execute({
    sql: 'SELECT content_hash FROM replica_watermark WHERE tenant_id = ?',
    args: [tenantId],
  });
  const value = result.rows[0]?.content_hash;
  return typeof value === 'string' ? value : null;
}

export async function validateReplicaIntegrity(tenantId: string): Promise<IntegrityResult> {
  const integrityCheck = await runIntegrityCheck();
  const expectedHash = await getExpectedChecksum(tenantId);
  const actualHash = await computeReplicaChecksum(tenantId);
  const checksumMatch = expectedHash === null || expectedHash === actualHash;

  return {
    ok: integrityCheck === 'ok' && checksumMatch,
    integrityCheck,
    checksumMatch,
    expectedHash,
    actualHash,
  };
}

export async function listReplicaTenantIds(): Promise<string[]> {
  const client = getLibSqlClient();
  try {
    const result = await client.execute('SELECT DISTINCT tenant_id FROM replica_watermark');
    return result.rows.map((row) => String(row.tenant_id));
  } catch {
    return [];
  }
}

export async function runGlobalIntegrityCheck(): Promise<GlobalIntegrityResult> {
  const databaseIntegrity = await runIntegrityCheck();
  const tenantIds = await listReplicaTenantIds();
  const tenants = await Promise.all(
    tenantIds.map(async (tenantId) => {
      const result = await validateReplicaIntegrity(tenantId);
      return { tenantId, ok: result.ok, checksumMatch: result.checksumMatch };
    })
  );
  return {
    ok: databaseIntegrity === 'ok' && tenants.every((t) => t.ok),
    databaseIntegrity,
    tenants,
  };
}

export async function reconcileReplica(tenantId: string): Promise<{ reSynced: boolean }> {
  const validation = await validateReplicaIntegrity(tenantId);
  if (validation.ok) return { reSynced: false };

  await executeLibSqlWrite(
    { sql: 'DELETE FROM job WHERE tenant_id = ?', args: [tenantId] },
    'reconcileReplicaJobs'
  );
  await executeLibSqlWrite(
    { sql: 'DELETE FROM node WHERE tenant_id = ?', args: [tenantId] },
    'reconcileReplicaNodes'
  );
  await executeLibSqlWrite(
    { sql: 'DELETE FROM replica_watermark WHERE tenant_id = ?', args: [tenantId] },
    'reconcileReplicaWatermark'
  );

  await syncStateToLibSql(tenantId);
  return { reSynced: true };
}

let integrityInterval: NodeJS.Timeout | undefined;

export function startIntegrityMonitoring(): void {
  if (integrityInterval) return;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;

  const intervalMs = getIntegrityIntervalMs();
  integrityInterval = setInterval(async () => {
    try {
      const result = await runGlobalIntegrityCheck();
      // eslint-disable-next-line no-console
      console.info(`LibSQL integrity check complete: ${JSON.stringify(result)}`);
      if (!result.ok) {
        for (const tenant of result.tenants.filter((t) => !t.ok)) {
          try {
            const reconcileResult = await reconcileReplica(tenant.tenantId);
            // eslint-disable-next-line no-console
            console.info(
              `LibSQL replica reconcile for ${tenant.tenantId}: ${JSON.stringify(reconcileResult)}`
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`LibSQL replica reconcile failed for ${tenant.tenantId}:`, err);
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('LibSQL integrity check failed:', err);
    }
  }, intervalMs);

  integrityInterval.unref();
}

export function stopIntegrityMonitoring(): void {
  if (integrityInterval) {
    clearInterval(integrityInterval);
    integrityInterval = undefined;
  }
}
