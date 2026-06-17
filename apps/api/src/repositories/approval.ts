import { desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function createApproval(
  ctx: TenantContext,
  input: {
    jobId: string;
    requestedBy: string;
    reason?: string;
  }
): Promise<typeof schema.approval.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.approval)
    .values({
      tenantId: ctx.tenantId,
      jobId: input.jobId,
      status: 'pending',
      requestedBy: input.requestedBy,
      reason: input.reason ?? null,
    })
    .returning();
  return row;
}

export async function getApprovalById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.approval.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.approval)
    .where(eq(schema.approval.id, id));
  return row;
}

export async function getApprovalByJobId(
  ctx: TenantContext,
  jobId: string
): Promise<typeof schema.approval.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.approval)
    .where(eq(schema.approval.jobId, jobId))
    .orderBy(desc(schema.approval.createdAt))
    .limit(1);
  return row;
}

export async function listPendingApprovals(
  ctx: TenantContext
): Promise<(typeof schema.approval.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.approval)
    .where(eq(schema.approval.status, 'pending'))
    .orderBy(desc(schema.approval.createdAt));
}

export async function listApprovals(
  ctx: TenantContext
): Promise<(typeof schema.approval.$inferSelect)[]> {
  return ctx.tenantScopedDb.select().from(schema.approval).orderBy(desc(schema.approval.createdAt));
}

export async function decideApproval(
  ctx: TenantContext,
  id: string,
  decision: 'approved' | 'denied',
  decidedBy: string,
  reason?: string
): Promise<typeof schema.approval.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.approval)
    .set({
      status: decision,
      decidedBy,
      reason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.approval.id, id))
    .returning();
  return row;
}
