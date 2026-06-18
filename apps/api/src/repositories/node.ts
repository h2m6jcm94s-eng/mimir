import { eq } from 'drizzle-orm';
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

export async function getNode(ctx: TenantContext, nodeId: string) {
  const [found] = await ctx.tenantScopedDb
    .select({
      id: schema.node.id,
      tenantId: schema.node.tenantId,
      ownerUserAccountId: schema.node.ownerUserAccountId,
      kind: schema.node.kind,
      name: schema.node.name,
      tier: schema.node.tier,
      tailnetAddr: schema.node.tailnetAddr,
      publicKey: schema.node.publicKey,
      status: schema.node.status,
      lastSeen: schema.node.lastSeen,
      createdAt: schema.node.createdAt,
    })
    .from(schema.node)
    .where(eq(schema.node.id, nodeId));
  return found;
}

export async function updateNodeHeartbeat(
  ctx: TenantContext,
  nodeId: string,
  status: (typeof schema.node.$inferSelect)['status'] = 'up'
) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.node)
    .set({ status, lastSeen: new Date() })
    .where(eq(schema.node.id, nodeId))
    .returning({
      id: schema.node.id,
      status: schema.node.status,
      lastSeen: schema.node.lastSeen,
    });
  return updated;
}
