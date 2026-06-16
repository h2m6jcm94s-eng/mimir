import { eq, sql } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';

/**
 * Inferred Drizzle transaction type from db.transaction's callback parameter.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

let rawDbWarningLogged = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(tenantId: string): void {
  if (!UUID_REGEX.test(tenantId)) {
    throw new Error(`Expected UUID-shaped tenantId, got: ${tenantId}`);
  }
}

/**
 * Tenant context must be created for every database operation outside an HTTP request
 * (workers, cron jobs, Temporal activities). Inside HTTP requests, the middleware creates it.
 */
export class TenantContext {
  constructor(
    public readonly tenantId: string,
    private readonly tx?: Tx
  ) {
    if (!tenantId) {
      throw new Error('TenantContext requires a non-empty tenantId');
    }
  }

  get tenantScopedDb() {
    // This wrapper is the single place where tenant_id is applied.
    // All repository functions should accept a TenantContext instead of the raw db.
    if (this.tx) {
      return this.tx;
    }

    if (!rawDbWarningLogged && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      rawDbWarningLogged = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[TenantContext] Using raw db outside of a transaction; RLS is not enforced. ' +
          'Use withTenantTransaction for tenant-scoped database work.'
      );
    }

    return db;
  }

  async ensureTenantExists() {
    const existing = await this.tenantScopedDb.query.tenant.findFirst({
      where: eq(schema.tenant.id, this.tenantId),
    });
    if (!existing) {
      throw new Error(`Tenant ${this.tenantId} not found`);
    }
    return existing;
  }
}

/**
 * Run async database work inside a tenant-scoped transaction.
 * Sets `app.tenant_id` with SET LOCAL so Postgres RLS policies enforce isolation.
 */
export async function withTenantTransaction<T>(
  tenantId: string,
  fn: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  assertUuid(tenantId);
  return db.transaction(async (tx) => {
    // SET LOCAL does not accept query parameters, so the validated UUID is inlined safely.
    await tx.execute(sql`SET LOCAL app.tenant_id = ${sql.raw(`'${tenantId}'`)}`);
    const ctx = new TenantContext(tenantId, tx);
    return fn(ctx);
  });
}

/**
 * Run async work inside a tenant context.
 *
 * @deprecated Prefer withTenantTransaction for database operations so RLS is enforced.
 * This helper no longer opens a transaction and should only be used for non-database work.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  const ctx = new TenantContext(tenantId);
  return fn(ctx);
}
