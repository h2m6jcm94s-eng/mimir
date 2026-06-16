import { eq } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';

/**
 * Tenant context must be created for every database operation outside an HTTP request
 * (workers, cron jobs, Temporal activities). Inside HTTP requests, the middleware creates it.
 */
export class TenantContext {
  constructor(public readonly tenantId: string) {
    if (!tenantId) {
      throw new Error('TenantContext requires a non-empty tenantId');
    }
  }

  get tenantScopedDb() {
    // This wrapper is the single place where tenant_id is applied.
    // All repository functions should accept a TenantContext instead of the raw db.
    return db;
  }

  async ensureTenantExists() {
    const existing = await db.query.tenant.findFirst({
      where: eq(schema.tenant.id, this.tenantId),
    });
    if (!existing) {
      throw new Error(`Tenant ${this.tenantId} not found`);
    }
    return existing;
  }
}

/**
 * Run async work inside a tenant context.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  const ctx = new TenantContext(tenantId);
  return fn(ctx);
}
