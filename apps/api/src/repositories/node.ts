import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function listNodes(ctx: TenantContext) {
  return ctx.tenantScopedDb.select().from(schema.node);
}
