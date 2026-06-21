import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type AgentReputationRow = typeof schema.agentReputation.$inferSelect;

export async function getOrCreateAgentReputation(
  ctx: TenantContext,
  role: string
): Promise<AgentReputationRow> {
  const [existing] = await ctx.tenantScopedDb
    .select()
    .from(schema.agentReputation)
    .where(
      and(eq(schema.agentReputation.tenantId, ctx.tenantId), eq(schema.agentReputation.role, role))
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await ctx.tenantScopedDb
    .insert(schema.agentReputation)
    .values({
      tenantId: ctx.tenantId,
      role,
      score: 0,
      successCount: 0,
      failureCount: 0,
    })
    .returning();
  return created;
}

export async function listAgentReputations(ctx: TenantContext): Promise<AgentReputationRow[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.agentReputation)
    .where(eq(schema.agentReputation.tenantId, ctx.tenantId))
    .orderBy(desc(schema.agentReputation.score), desc(schema.agentReputation.lastUpdatedAt));
}

export async function recordAgentReputationOutcome(
  ctx: TenantContext,
  role: string,
  outcome: 'success' | 'failure'
): Promise<AgentReputationRow> {
  const row = await getOrCreateAgentReputation(ctx, role);
  const successCount = row.successCount + (outcome === 'success' ? 1 : 0);
  const failureCount = row.failureCount + (outcome === 'failure' ? 1 : 0);
  const score = successCount - failureCount;

  const [updated] = await ctx.tenantScopedDb
    .update(schema.agentReputation)
    .set({
      successCount,
      failureCount,
      score,
      lastUpdatedAt: new Date(),
    })
    .where(
      and(eq(schema.agentReputation.tenantId, ctx.tenantId), eq(schema.agentReputation.role, role))
    )
    .returning();
  return updated;
}
