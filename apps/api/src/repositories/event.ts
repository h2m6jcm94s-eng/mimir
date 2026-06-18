import { and, desc, eq, lt } from 'drizzle-orm';
import { jobEvent } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateJobEventInput {
  jobId: string;
  type: (typeof jobEvent.$inferInsert)['type'];
  payload?: Record<string, unknown>;
}

export interface ListJobEventsInput {
  jobId: string;
  limit: number;
  cursor?: string;
}

export async function createJobEvent(ctx: TenantContext, input: CreateJobEventInput) {
  const [created] = await ctx.tenantScopedDb
    .insert(jobEvent)
    .values({
      tenantId: ctx.tenantId,
      jobId: input.jobId,
      type: input.type,
      payload: input.payload ?? {},
    })
    .returning();
  return created;
}

export async function listJobEvents(ctx: TenantContext, input: ListJobEventsInput) {
  const filters = [eq(jobEvent.jobId, input.jobId)];
  if (input.cursor) {
    filters.push(lt(jobEvent.id, input.cursor));
  }

  const rows = await ctx.tenantScopedDb
    .select()
    .from(jobEvent)
    .where(and(...filters))
    .orderBy(desc(jobEvent.createdAt), desc(jobEvent.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? last.id : undefined;

  return {
    data: data.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
