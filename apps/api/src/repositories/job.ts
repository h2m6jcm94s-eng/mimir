import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateJobInput {
  idempotencyKey: string;
  type: string;
  tier: number;
  input: unknown;
}

export async function createJob(ctx: TenantContext, input: CreateJobInput) {
  const [created] = await ctx.tenantScopedDb
    .insert(schema.job)
    .values({
      tenantId: ctx.tenantId,
      idempotencyKey: input.idempotencyKey,
      type: input.type,
      tier: input.tier,
      input: input.input as Record<string, unknown>,
      status: 'queued',
    })
    .returning();
  return created;
}

export async function updateJobStatus(
  ctx: TenantContext,
  jobId: string,
  status: (typeof schema.job.$inferSelect)['status'],
  update: Partial<typeof schema.job.$inferSelect> = {}
) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set({
      status,
      ...update,
      updatedAt: new Date(),
    })
    .where(eq(schema.job.id, jobId))
    .returning();
  return updated;
}

export async function addJobCost(ctx: TenantContext, jobId: string, deltaUsd: number) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set({
      costUsd: sql`${schema.job.costUsd} + ${deltaUsd}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.job.id, jobId))
    .returning();
  return updated;
}

export async function getJob(ctx: TenantContext, jobId: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(eq(schema.job.id, jobId));
  return found;
}

export async function findJobByIdempotency(ctx: TenantContext, idempotencyKey: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(eq(schema.job.idempotencyKey, idempotencyKey));
  return found;
}
