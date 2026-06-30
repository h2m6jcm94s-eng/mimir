import { createHash } from 'node:crypto';

import * as schema from '../../db/schema';
import { withTenantTransaction } from '../../db/tenant-context';
import { executeLibSqlWrite } from './lifecycle';

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toSnakeCaseKeys(row: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[toSnakeCase(key)] = value;
    return acc;
  }, {});
}

function canonicalRow(row: Record<string, unknown>): string {
  const sorted = Object.keys(row)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = row[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

export function computeHash(rows: Record<string, unknown>[]): string {
  const hash = createHash('sha256');
  for (const row of rows) {
    hash.update(canonicalRow(row));
  }
  return hash.digest('hex');
}

export async function computePostgresChecksum(tenantId: string): Promise<string> {
  return withTenantTransaction(tenantId, async (ctx) => {
    const jobs = await ctx.tenantScopedDb.select().from(schema.job).orderBy(schema.job.id);
    const nodes = await ctx.tenantScopedDb.select().from(schema.node).orderBy(schema.node.id);
    const normalized = [...jobs, ...nodes].map((row) =>
      toSnakeCaseKeys(row as Record<string, unknown>)
    );
    return computeHash(normalized);
  });
}

export async function updateExpectedChecksum(tenantId: string, hash: string): Promise<void> {
  await executeLibSqlWrite(
    {
      sql: `
        INSERT INTO replica_watermark (tenant_id, last_sync_at, content_hash)
        VALUES (?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          content_hash = excluded.content_hash,
          last_sync_at = excluded.last_sync_at
      `,
      args: [tenantId, new Date().toISOString(), hash],
    },
    'updateExpectedChecksum'
  );
}
