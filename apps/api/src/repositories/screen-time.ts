import { and, desc, eq, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateScreenTimeEntryInput {
  date: string;
  app?: string;
  category?: string;
  minutes: number;
}

export interface ListScreenTimeOptions {
  from?: string;
  to?: string;
  app?: string;
  limit?: number;
}

export interface ScreenTimeSummaryResult {
  totalMinutes: number;
  entryCount: number;
  dailyTotals: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

export async function createScreenTimeEntry(
  ctx: TenantContext,
  input: CreateScreenTimeEntryInput
): Promise<typeof schema.screenTimeEntry.$inferSelect> {
  const rows = await ctx.tenantScopedDb
    .insert(schema.screenTimeEntry)
    .values({
      tenantId: ctx.tenantId,
      date: input.date,
      app: input.app ?? null,
      category: input.category ?? null,
      minutes: input.minutes,
    })
    .returning();
  return rows[0];
}

export async function listScreenTimeEntries(
  ctx: TenantContext,
  options: ListScreenTimeOptions
): Promise<(typeof schema.screenTimeEntry.$inferSelect)[]> {
  const conditions = [eq(schema.screenTimeEntry.tenantId, ctx.tenantId)];
  if (options.from) {
    conditions.push(gte(schema.screenTimeEntry.date, options.from));
  }
  if (options.to) {
    conditions.push(lte(schema.screenTimeEntry.date, options.to));
  }
  if (options.app) {
    conditions.push(eq(schema.screenTimeEntry.app, options.app));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.screenTimeEntry)
    .where(and(...conditions))
    .orderBy(desc(schema.screenTimeEntry.date), desc(schema.screenTimeEntry.createdAt))
    .limit(options.limit ?? 100);
}

export async function getScreenTimeEntryById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.screenTimeEntry.$inferSelect | undefined> {
  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.screenTimeEntry)
    .where(
      and(eq(schema.screenTimeEntry.tenantId, ctx.tenantId), eq(schema.screenTimeEntry.id, id))
    )
    .limit(1);
  return rows[0];
}

export async function deleteScreenTimeEntry(ctx: TenantContext, id: string): Promise<boolean> {
  const rows = await ctx.tenantScopedDb
    .delete(schema.screenTimeEntry)
    .where(
      and(eq(schema.screenTimeEntry.tenantId, ctx.tenantId), eq(schema.screenTimeEntry.id, id))
    )
    .returning({ id: schema.screenTimeEntry.id });
  return rows.length > 0;
}

export async function getScreenTimeSummary(
  ctx: TenantContext,
  options: ListScreenTimeOptions
): Promise<ScreenTimeSummaryResult> {
  const conditions = [eq(schema.screenTimeEntry.tenantId, ctx.tenantId)];
  if (options.from) {
    conditions.push(gte(schema.screenTimeEntry.date, options.from));
  }
  if (options.to) {
    conditions.push(lte(schema.screenTimeEntry.date, options.to));
  }

  const rows = await ctx.tenantScopedDb
    .select({
      date: schema.screenTimeEntry.date,
      category: schema.screenTimeEntry.category,
      minutes: schema.screenTimeEntry.minutes,
    })
    .from(schema.screenTimeEntry)
    .where(and(...conditions));

  const dailyTotals: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  let totalMinutes = 0;

  for (const row of rows) {
    totalMinutes += row.minutes;
    const day = row.date;
    dailyTotals[day] = (dailyTotals[day] ?? 0) + row.minutes;
    const category = row.category ?? 'Uncategorized';
    categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + row.minutes;
  }

  return {
    totalMinutes,
    entryCount: rows.length,
    dailyTotals,
    categoryBreakdown,
  };
}
