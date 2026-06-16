import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateJobInput {
  idempotencyKey: string;
  type: string;
  tier: number;
  input: unknown;
}

export interface ListJobsInput {
  limit: number;
  cursor?: string;
}

export interface ListJobsOutput {
  data: (typeof schema.job.$inferSelect)[];
  nextCursor?: string;
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

export async function getTenantDailyCostUsd(ctx: TenantContext, date: Date): Promise<number> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [row] = await ctx.tenantScopedDb
    .select({
      total: sql`coalesce(sum(${schema.job.costUsd}), 0)`,
    })
    .from(schema.job)
    .where(and(gte(schema.job.createdAt, start), lt(schema.job.createdAt, end)));

  return Number(row?.total ?? 0);
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

export async function listJobs(ctx: TenantContext, input: ListJobsInput): Promise<ListJobsOutput> {
  const cursorFilter = input.cursor ? lt(schema.job.id, input.cursor) : undefined;

  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(cursorFilter)
    .orderBy(desc(schema.job.createdAt), desc(schema.job.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? last.id : undefined;

  return { data, nextCursor };
}
