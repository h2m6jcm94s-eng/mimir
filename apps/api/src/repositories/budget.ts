import { eq, gte } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface UpsertBudgetInput {
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  throttleThreshold?: number;
  enabled?: boolean;
}

export async function getBudget(ctx: TenantContext) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.budget)
    .where(eq(schema.budget.tenantId, ctx.tenantId));
  return found;
}

export async function upsertBudget(ctx: TenantContext, input: UpsertBudgetInput) {
  const existing = await getBudget(ctx);

  if (existing) {
    const set: Partial<typeof schema.budget.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.dailyBudgetUsd !== undefined) set.dailyBudgetUsd = input.dailyBudgetUsd;
    if (input.monthlyBudgetUsd !== undefined) set.monthlyBudgetUsd = input.monthlyBudgetUsd;
    if (input.throttleThreshold !== undefined)
      set.throttleThreshold = String(input.throttleThreshold);
    if (input.enabled !== undefined) set.enabled = input.enabled;

    const [updated] = await ctx.tenantScopedDb
      .update(schema.budget)
      .set(set)
      .where(eq(schema.budget.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await ctx.tenantScopedDb
    .insert(schema.budget)
    .values({
      tenantId: ctx.tenantId,
      dailyBudgetUsd: input.dailyBudgetUsd ?? 0,
      monthlyBudgetUsd: input.monthlyBudgetUsd ?? 0,
      throttleThreshold:
        input.throttleThreshold === undefined ? '0.8' : String(input.throttleThreshold),
      enabled: input.enabled ?? true,
    })
    .returning();
  return created;
}

export interface SpendSeries {
  daily: Array<{ date: string; usd: number }>;
  tier: Array<{ tier: number; usd: number }>;
}

export async function getSpendSeries(
  ctx: TenantContext,
  now: Date,
  days: number
): Promise<SpendSeries> {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1)
  );

  const rows = await ctx.tenantScopedDb
    .select({
      createdAt: schema.job.createdAt,
      costUsd: schema.job.costUsd,
      tier: schema.job.tier,
    })
    .from(schema.job)
    .where(gte(schema.job.createdAt, start));

  const dailyTotals = new Map<string, number>();
  const tierTotals = new Map<number, number>();

  for (const row of rows) {
    const date = new Date(row.createdAt).toISOString().slice(0, 10);
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + (row.costUsd ?? 0));
    tierTotals.set(row.tier ?? 0, (tierTotals.get(row.tier ?? 0) ?? 0) + (row.costUsd ?? 0));
  }

  const daily: Array<{ date: string; usd: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const date = d.toISOString().slice(0, 10);
    daily.push({ date, usd: dailyTotals.get(date) ?? 0 });
  }

  const tier = [0, 1, 2].map((t) => ({ tier: t, usd: tierTotals.get(t) ?? 0 }));

  return { daily, tier };
}
