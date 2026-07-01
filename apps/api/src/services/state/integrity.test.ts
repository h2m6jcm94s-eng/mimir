import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeHash } from './checksum';

async function importIntegrity(libSqlUrl: string) {
  vi.resetModules();
  vi.stubEnv('LIBSQL_URL', libSqlUrl);
  vi.stubEnv('LIBSQL_SYNC_URL', '');
  vi.stubEnv('LIBSQL_AUTH_TOKEN', '');
  vi.stubEnv('LIBSQL_ENCRYPTION_KEY', '');
  vi.stubEnv('NODE_ENV', 'test');
  const mod = await import('./integrity.js');
  const { initializeLibSqlSchema } = await import('./libsql-schema.js');
  const { executeLibSqlWrite } = await import('./lifecycle.js');
  return { ...mod, initializeLibSqlSchema, executeLibSqlWrite };
}

describe('LibSQL integrity', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mimir-integrity-'));
    dbPath = path.join(tmpDir, 'state.db');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('computeHash is deterministic and sensitive to row changes', () => {
    const rows = [{ id: 'a', status: 'done' }];
    const hash1 = computeHash(rows);
    const hash2 = computeHash(rows);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(computeHash([{ id: 'a', status: 'running' }]));
  });

  it('returns ok integrity for an empty database', async () => {
    const { runIntegrityCheck, initializeLibSqlSchema } = await importIntegrity(`file:${dbPath}`);
    await initializeLibSqlSchema();
    const result = await runIntegrityCheck();
    expect(result).toBe('ok');
  });

  it('validates a tenant with no expected checksum as ok', async () => {
    const { validateReplicaIntegrity, initializeLibSqlSchema } = await importIntegrity(
      `file:${dbPath}`
    );
    await initializeLibSqlSchema();
    const result = await validateReplicaIntegrity(randomUUID());
    expect(result.ok).toBe(true);
    expect(result.integrityCheck).toBe('ok');
    expect(result.expectedHash).toBeNull();
  });

  it('detects checksum mismatch after tampering', async () => {
    const { validateReplicaIntegrity, initializeLibSqlSchema, executeLibSqlWrite } =
      await importIntegrity(`file:${dbPath}`);
    await initializeLibSqlSchema();

    const tenantId = randomUUID();
    const createdAt = new Date().toISOString();
    await executeLibSqlWrite(
      {
        sql: `INSERT INTO job (id, tenant_id, idempotency_key, type, tier, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), tenantId, 'j1', 'test', 0, 'done', createdAt],
      },
      'test-seed'
    );
    await executeLibSqlWrite(
      {
        sql: `INSERT INTO replica_watermark (tenant_id, last_sync_at, last_synced_epoch, content_hash)
              VALUES (?, ?, ?, ?)`,
        args: [tenantId, createdAt, 0, 'wrong-hash'],
      },
      'test-seed-watermark'
    );

    const result = await validateReplicaIntegrity(tenantId);
    expect(result.ok).toBe(false);
    expect(result.checksumMatch).toBe(false);
  });

  it('lists tenant ids from replica watermark', async () => {
    const { listReplicaTenantIds, initializeLibSqlSchema, executeLibSqlWrite } =
      await importIntegrity(`file:${dbPath}`);
    await initializeLibSqlSchema();

    const tenantId = randomUUID();
    await executeLibSqlWrite(
      {
        sql: `INSERT INTO replica_watermark (tenant_id, last_sync_at, last_synced_epoch)
              VALUES (?, ?, ?)`,
        args: [tenantId, new Date().toISOString(), 0],
      },
      'test-seed'
    );

    const ids = await listReplicaTenantIds();
    expect(ids).toContain(tenantId);
  });
});
