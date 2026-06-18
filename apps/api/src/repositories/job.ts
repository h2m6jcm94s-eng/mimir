import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { assertCurrentEpoch } from '../services/fencing/fencing';
import { jobsStatusChangedCounter } from '../services/metrics/registry';

export interface CreateJobInput {
  idempotencyKey: string;
  type: string;
  tier: number;
  input: unknown;
}

export interface ListJobsInput {
  limit: number;
  cursor?: string;
  status?: (typeof schema.job.$inferSelect)['status'];
  type?: string;
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

const terminalStatuses = new Set<string>(['done', 'failed']);

export async function updateJobStatus(
  ctx: TenantContext,
  jobId: string,
  status: (typeof schema.job.$inferSelect)['status'],
  update: Partial<typeof schema.job.$inferSelect> = {},
  claimedEpoch?: number
) {
  if (claimedEpoch !== undefined) {
    await assertCurrentEpoch(ctx, claimedEpoch);
  }

  const existing = await getJob(ctx, jobId);
  const set: Partial<typeof schema.job.$inferSelect> = {
    status,
    ...update,
    updatedAt: new Date(),
  };

  if (status === 'running' && !existing?.startedAt) {
    set.startedAt = new Date();
  }
  if (terminalStatuses.has(status) && !existing?.finishedAt) {
    set.finishedAt = new Date();
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set(set)
    .where(eq(schema.job.id, jobId))
    .returning();

  jobsStatusChangedCounter.inc({ status });

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

export async function getJobTimeline(
  ctx: TenantContext,
  hours: number
): Promise<{ hour: string; pending: number }[]> {
  const now = new Date();
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const rows = await ctx.tenantScopedDb
    .select({
      bucket: sql<Date>`date_trunc('hour', ${schema.job.createdAt})`,
      total: count(),
    })
    .from(schema.job)
    .where(gte(schema.job.createdAt, start))
    .groupBy(sql`date_trunc('hour', ${schema.job.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${schema.job.createdAt})`);

  return rows.map((row) => {
    const date = new Date(row.bucket);
    const hour = `${String(date.getUTCHours()).padStart(2, '0')}:00`;
    return { hour, pending: Number(row.total) };
  });
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

export async function getTenantMonthlyCostUsd(ctx: TenantContext, date: Date): Promise<number> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  const [row] = await ctx.tenantScopedDb
    .select({
      total: sql`coalesce(sum(${schema.job.costUsd}), 0)`,
    })
    .from(schema.job)
    .where(and(gte(schema.job.createdAt, start), lt(schema.job.createdAt, end)));

  return Number(row?.total ?? 0);
}

export async function getTenantHourlyBurnUsd(
  ctx: TenantContext,
  now: Date,
  hours: number
): Promise<number> {
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const [row] = await ctx.tenantScopedDb
    .select({
      total: sql`coalesce(sum(${schema.job.costUsd}), 0)`,
    })
    .from(schema.job)
    .where(gte(schema.job.createdAt, start));

  const total = Number(row?.total ?? 0);
  return Math.round(total / hours);
}

export async function getJob(ctx: TenantContext, jobId: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(eq(schema.job.id, jobId));
  return found;
}

export async function setJobWorkflowIds(
  ctx: TenantContext,
  jobId: string,
  workflowId: string,
  runId: string
) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set({ workflowId, runId, updatedAt: new Date() })
    .where(eq(schema.job.id, jobId))
    .returning();
  return updated;
}

export async function countJobsByStatus(
  ctx: TenantContext
): Promise<Record<(typeof schema.job.$inferSelect)['status'], number>> {
  const rows = await ctx.tenantScopedDb
    .select({ status: schema.job.status, total: count() })
    .from(schema.job)
    .groupBy(schema.job.status);

  const result = {} as Record<(typeof schema.job.$inferSelect)['status'], number>;
  for (const row of rows) {
    result[row.status] = Number(row.total);
  }
  return result;
}

export async function findJobByIdempotency(ctx: TenantContext, idempotencyKey: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(eq(schema.job.idempotencyKey, idempotencyKey));
  return found;
}

export async function listJobs(ctx: TenantContext, input: ListJobsInput): Promise<ListJobsOutput> {
  const filters: (ReturnType<typeof eq> | ReturnType<typeof lt> | undefined)[] = [];
  if (input.cursor) filters.push(lt(schema.job.id, input.cursor));
  if (input.status) filters.push(eq(schema.job.status, input.status));
  if (input.type) filters.push(eq(schema.job.type, input.type));

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.job)
    .where(whereClause)
    .orderBy(desc(schema.job.createdAt), desc(schema.job.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? last.id : undefined;

  return { data, nextCursor };
}
