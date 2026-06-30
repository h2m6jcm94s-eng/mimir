import type { InStatement, ResultSet } from '@libsql/client';
import { getLibSqlClient } from '../../db/libsql';

export interface MaintenanceResult {
  prunedRows: number;
  vacuumed: boolean;
  freedBytes?: number;
}

export function getRetentionDays(): number {
  const raw = process.env.LIBSQL_RETENTION_DAYS;
  if (!raw) return 30;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 30;
  return parsed;
}

export function getVacuumIntervalMs(): number {
  const raw = process.env.LIBSQL_VACUUM_INTERVAL_MS;
  if (!raw) return 60 * 60 * 1000; // 1 hour
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 60_000) return 60 * 60 * 1000;
  return parsed;
}

export function isWriteFailureFatal(): boolean {
  if (process.env.LIBSQL_WRITE_FAILURE_FATAL) {
    return (
      process.env.LIBSQL_WRITE_FAILURE_FATAL === '1' ||
      process.env.LIBSQL_WRITE_FAILURE_FATAL === 'true'
    );
  }
  return process.env.NODE_ENV === 'production';
}

function isFatalWriteError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('database or disk is full')) return true;
    if (message.includes('disk i/o error')) return true;
    if (message.includes('no space left')) return true;
    if (message.includes('sqlite_full')) return true;
    // LibSQL server error codes sometimes appear in the message.
    if (message.includes('code: 13')) return true;
    if (message.includes('errno 28')) return true;
  }
  return false;
}

export function handleLibSqlWriteError(error: unknown, context: string): void {
  if (!isWriteFailureFatal()) return;
  if (!isFatalWriteError(error)) return;
  // eslint-disable-next-line no-console
  console.error(
    `FATAL: LibSQL write failure in ${context}; disk-full or I/O error detected. Exiting to avoid zombie state.`,
    error
  );
  process.exit(1);
}

export async function executeLibSqlWrite(stmt: InStatement, context: string): Promise<ResultSet> {
  const client = getLibSqlClient();
  try {
    return await client.execute(stmt);
  } catch (err) {
    handleLibSqlWriteError(err, context);
    throw err;
  }
}

export async function executeMultipleLibSqlWrite(sql: string, context: string): Promise<void> {
  const client = getLibSqlClient();
  try {
    return await client.executeMultiple(sql);
  } catch (err) {
    handleLibSqlWriteError(err, context);
    throw err;
  }
}

export async function pruneReplicaJobs(retentionDays = getRetentionDays()): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await executeLibSqlWrite(
    {
      sql: 'DELETE FROM job WHERE finished_at IS NOT NULL AND finished_at < ?',
      args: [cutoff],
    },
    'pruneReplicaJobs'
  );
  return Number(result.rowsAffected ?? 0);
}

export async function vacuumLibSql(): Promise<{ freedBytes: number | undefined }> {
  const client = getLibSqlClient();

  let before: number | undefined;
  try {
    const pageCount = await client.execute('PRAGMA page_count;');
    const freelist = await client.execute('PRAGMA freelist_count;');
    const pageSize = await client.execute('PRAGMA page_size;');
    const used =
      Number(pageCount.rows[0]?.page_count ?? 0) - Number(freelist.rows[0]?.freelist_count ?? 0);
    before = used * Number(pageSize.rows[0]?.page_size ?? 0);
  } catch {
    // Best-effort sizing; continue with VACUUM.
  }

  await executeLibSqlWrite('VACUUM;', 'vacuumLibSql');

  let after: number | undefined;
  try {
    const pageCount = await client.execute('PRAGMA page_count;');
    const freelist = await client.execute('PRAGMA freelist_count;');
    const pageSize = await client.execute('PRAGMA page_size;');
    const used =
      Number(pageCount.rows[0]?.page_count ?? 0) - Number(freelist.rows[0]?.freelist_count ?? 0);
    after = used * Number(pageSize.rows[0]?.page_size ?? 0);
  } catch {
    // ignore
  }

  return {
    freedBytes:
      before !== undefined && after !== undefined ? Math.max(0, before - after) : undefined,
  };
}

export async function runLifecycleMaintenance(): Promise<MaintenanceResult> {
  const prunedRows = await pruneReplicaJobs();
  const { freedBytes } = await vacuumLibSql();
  return { prunedRows, vacuumed: true, freedBytes };
}

let lifecycleInterval: NodeJS.Timeout | undefined;

export function startLifecycleMaintenance(): void {
  if (lifecycleInterval) return;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;

  const intervalMs = getVacuumIntervalMs();
  lifecycleInterval = setInterval(async () => {
    try {
      const result = await runLifecycleMaintenance();
      // eslint-disable-next-line no-console
      console.info(`LibSQL lifecycle maintenance complete: ${JSON.stringify(result)}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('LibSQL lifecycle maintenance failed:', err);
    }
  }, intervalMs);

  // Unref so the interval doesn't keep the process alive by itself in tests/short-lived scripts.
  lifecycleInterval.unref();
}

export function stopLifecycleMaintenance(): void {
  if (lifecycleInterval) {
    clearInterval(lifecycleInterval);
    lifecycleInterval = undefined;
  }
}
