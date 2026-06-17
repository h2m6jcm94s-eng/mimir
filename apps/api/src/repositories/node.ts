import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function listNodes(ctx: TenantContext) {
  return ctx.tenantScopedDb
    .select({
      id: schema.node.id,
      tenantId: schema.node.tenantId,
      ownerUserAccountId: schema.node.ownerUserAccountId,
      kind: schema.node.kind,
      name: schema.node.name,
      tier: schema.node.tier,
      tailnetAddr: schema.node.tailnetAddr,
      status: schema.node.status,
      lastSeen: schema.node.lastSeen,
      createdAt: schema.node.createdAt,
    })
    .from(schema.node);
}
