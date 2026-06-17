import type { AgentRoleInput } from '@mimir/shared-types';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function listAgentRoles(ctx: TenantContext) {
  return ctx.tenantScopedDb.query.agentRole.findMany({
    where: eq(schema.agentRole.tenantId, ctx.tenantId),
    orderBy: [schema.agentRole.priority, schema.agentRole.name],
  });
}

export async function getAgentRole(ctx: TenantContext, id: string) {
  return ctx.tenantScopedDb.query.agentRole.findFirst({
    where: and(eq(schema.agentRole.tenantId, ctx.tenantId), eq(schema.agentRole.id, id)),
  });
}

export async function createAgentRole(ctx: TenantContext, input: AgentRoleInput) {
  const [role] = await ctx.tenantScopedDb
    .insert(schema.agentRole)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      name: input.name,
      description: input.description,
      tier: input.tier,
      priority: input.priority,
      provider: input.provider,
      model: input.model,
      capabilities: input.capabilities,
      isDefault: input.isDefault,
    })
    .returning();
  return role;
}

export async function updateAgentRole(
  ctx: TenantContext,
  id: string,
  input: Partial<AgentRoleInput>
) {
  const [role] = await ctx.tenantScopedDb
    .update(schema.agentRole)
    .set({
      ...(input.kind && { kind: input.kind }),
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.tier !== undefined && { tier: input.tier }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.provider && { provider: input.provider }),
      ...(input.model !== undefined && { model: input.model }),
      ...(input.capabilities && { capabilities: input.capabilities }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.agentRole.tenantId, ctx.tenantId), eq(schema.agentRole.id, id)))
    .returning();
  return role;
}

export async function deleteAgentRole(ctx: TenantContext, id: string) {
  const [role] = await ctx.tenantScopedDb
    .delete(schema.agentRole)
    .where(and(eq(schema.agentRole.tenantId, ctx.tenantId), eq(schema.agentRole.id, id)))
    .returning();
  return role;
}

export async function findDefaultAgentRole(
  ctx: TenantContext,
  kind: (typeof schema.agentRole.kind.enumValues)[number],
  tier: number
) {
  return ctx.tenantScopedDb.query.agentRole.findFirst({
    where: and(
      eq(schema.agentRole.tenantId, ctx.tenantId),
      eq(schema.agentRole.kind, kind),
      eq(schema.agentRole.tier, tier),
      eq(schema.agentRole.isDefault, true)
    ),
    orderBy: (table, { desc }) => [desc(table.priority), desc(table.createdAt)],
  });
}
