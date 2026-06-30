import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importLifecycle(libSqlUrl: string, nodeEnv = 'test') {
  vi.resetModules();
  vi.stubEnv('LIBSQL_URL', libSqlUrl);
  vi.stubEnv('LIBSQL_SYNC_URL', '');
  vi.stubEnv('LIBSQL_AUTH_TOKEN', '');
  vi.stubEnv('LIBSQL_ENCRYPTION_KEY', '');
  vi.stubEnv('NODE_ENV', nodeEnv);
  const mod = await import('./lifecycle.js');
  const { initializeLibSqlSchema } = await import('./libsql-schema.js');
  return { ...mod, initializeLibSqlSchema };
}

describe('LibSQL lifecycle', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mimir-lifecycle-'));
    dbPath = path.join(tmpDir, 'state.db');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('returns default retention and vacuum intervals', async () => {
    vi.stubEnv('LIBSQL_RETENTION_DAYS', '');
    vi.stubEnv('LIBSQL_VACUUM_INTERVAL_MS', '');
    const { getRetentionDays, getVacuumIntervalMs } = await importLifecycle(`file:${dbPath}`);
    expect(getRetentionDays()).toBe(30);
    expect(getVacuumIntervalMs()).toBe(60 * 60 * 1000);
  });

  it('respects env overrides for retention and vacuum interval', async () => {
    vi.stubEnv('LIBSQL_RETENTION_DAYS', '7');
    vi.stubEnv('LIBSQL_VACUUM_INTERVAL_MS', '120000');
    const { getRetentionDays, getVacuumIntervalMs } = await importLifecycle(`file:${dbPath}`);
    expect(getRetentionDays()).toBe(7);
    expect(getVacuumIntervalMs()).toBe(120000);
  });

  it('rejects invalid env overrides and falls back to defaults', async () => {
    vi.stubEnv('LIBSQL_RETENTION_DAYS', 'not-a-number');
    vi.stubEnv('LIBSQL_VACUUM_INTERVAL_MS', '59'); // below minimum
    const { getRetentionDays, getVacuumIntervalMs } = await importLifecycle(`file:${dbPath}`);
    expect(getRetentionDays()).toBe(30);
    expect(getVacuumIntervalMs()).toBe(60 * 60 * 1000);
  });

  it('treats write failures as fatal in production by default', async () => {
    const { isWriteFailureFatal } = await importLifecycle(`file:${dbPath}`, 'production');
    expect(isWriteFailureFatal()).toBe(true);
  });

  it('allows opt-out of fatal write failures', async () => {
    vi.stubEnv('LIBSQL_WRITE_FAILURE_FATAL', '0');
    const { isWriteFailureFatal } = await importLifecycle(`file:${dbPath}`, 'production');
    expect(isWriteFailureFatal()).toBe(false);
  });

  it('exits on disk-full write errors when fatal mode is enabled', async () => {
    const { handleLibSqlWriteError } = await importLifecycle(`file:${dbPath}`, 'production');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleLibSqlWriteError(new Error('database or disk is full'), 'test-context');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('does not exit on non-fatal errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { handleLibSqlWriteError } = await importLifecycle(`file:${dbPath}`);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleLibSqlWriteError(new Error('some other sqlite error'), 'test-context');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('prunes finished jobs older than retention days', async () => {
    const { executeLibSqlWrite, pruneReplicaJobs, initializeLibSqlSchema } = await importLifecycle(
      `file:${dbPath}`
    );
    await initializeLibSqlSchema();

    const oldFinished = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recentFinished = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tenantId = randomUUID();

    await executeLibSqlWrite(
      {
        sql: `INSERT INTO job (id, tenant_id, idempotency_key, type, tier, status, finished_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), tenantId, 'old', 'test', 0, 'done', oldFinished, oldFinished],
      },
      'test-seed'
    );
    await executeLibSqlWrite(
      {
        sql: `INSERT INTO job (id, tenant_id, idempotency_key, type, tier, status, finished_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), tenantId, 'recent', 'test', 0, 'done', recentFinished, recentFinished],
      },
      'test-seed'
    );
    await executeLibSqlWrite(
      {
        sql: `INSERT INTO job (id, tenant_id, idempotency_key, type, tier, status, finished_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), tenantId, 'running', 'test', 0, 'running', null, recentFinished],
      },
      'test-seed'
    );

    const pruned = await pruneReplicaJobs(30);
    expect(pruned).toBe(1);

    const remaining = await executeLibSqlWrite(
      { sql: 'SELECT COUNT(*) as count FROM job', args: [] },
      'test-verify'
    );
    expect(Number(remaining.rows[0]?.count)).toBe(2);
  });

  it('vacuum reclaims space', async () => {
    const { executeLibSqlWrite, vacuumLibSql, initializeLibSqlSchema } = await importLifecycle(
      `file:${dbPath}`
    );
    await initializeLibSqlSchema();

    const tenantId = randomUUID();
    const createdAt = new Date().toISOString();
    // Insert and delete a bunch of rows to create free pages.
    for (let i = 0; i < 50; i++) {
      await executeLibSqlWrite(
        {
          sql: `INSERT INTO job (id, tenant_id, idempotency_key, type, tier, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [randomUUID(), tenantId, String(i), 'test', 0, 'done', createdAt],
        },
        'test-seed'
      );
    }
    await executeLibSqlWrite({ sql: 'DELETE FROM job', args: [] }, 'test-cleanup');

    const result = await vacuumLibSql();
    expect(result).toHaveProperty('freedBytes');
  });
});
