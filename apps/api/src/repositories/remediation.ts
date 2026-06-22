import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateRemediationInput {
  targetType: string;
  targetId: string;
  issue: string;
  action?: string;
  status?: 'pending' | 'running' | 'resolved' | 'failed';
  output?: Record<string, unknown>;
}

export async function createRemediationRun(
  ctx: TenantContext,
  input: CreateRemediationInput
): Promise<typeof schema.remediationRun.$inferSelect> {
  const rows = await ctx.tenantScopedDb
    .insert(schema.remediationRun)
    .values({
      tenantId: ctx.tenantId,
      targetType: input.targetType,
      targetId: input.targetId,
      issue: input.issue,
      action: input.action ?? null,
      status: input.status ?? 'pending',
      output: input.output ?? {},
    })
    .returning();
  return rows[0];
}

export async function getRemediationRunById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.remediationRun.$inferSelect | undefined> {
  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.remediationRun)
    .where(and(eq(schema.remediationRun.tenantId, ctx.tenantId), eq(schema.remediationRun.id, id)))
    .limit(1);
  return rows[0];
}

export async function listRemediationRuns(
  ctx: TenantContext,
  options: { status?: 'pending' | 'running' | 'resolved' | 'failed'; limit?: number } = {}
): Promise<(typeof schema.remediationRun.$inferSelect)[]> {
  const conditions = [eq(schema.remediationRun.tenantId, ctx.tenantId)];
  if (options.status) {
    conditions.push(eq(schema.remediationRun.status, options.status));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.remediationRun)
    .where(and(...conditions))
    .orderBy(desc(schema.remediationRun.createdAt))
    .limit(options.limit ?? 100);
}

export async function updateRemediationRun(
  ctx: TenantContext,
  id: string,
  input: {
    status?: 'pending' | 'running' | 'resolved' | 'failed';
    action?: string;
    output?: Record<string, unknown>;
  }
): Promise<typeof schema.remediationRun.$inferSelect | undefined> {
  const rows = await ctx.tenantScopedDb
    .update(schema.remediationRun)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.remediationRun.tenantId, ctx.tenantId), eq(schema.remediationRun.id, id)))
    .returning();
  return rows[0];
}
