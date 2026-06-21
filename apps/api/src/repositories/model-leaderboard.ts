import { and, eq, gte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type ModelInvocationStatus = (typeof schema.modelInvocation.$inferSelect)['status'];
export type ModelInvocationRow = typeof schema.modelInvocation.$inferSelect;

export interface CreateModelInvocationInput {
  provider: string;
  model: string;
  tier: number;
  status: ModelInvocationStatus;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  errorCode?: string;
}

export async function createModelInvocation(
  ctx: TenantContext,
  input: CreateModelInvocationInput
): Promise<ModelInvocationRow> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.modelInvocation)
    .values({
      tenantId: ctx.tenantId,
      provider: input.provider,
      model: input.model,
      tier: input.tier,
      status: input.status,
      latencyMs: input.latencyMs ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      costUsd: input.costUsd === undefined ? null : String(input.costUsd),
      errorCode: input.errorCode ?? null,
    })
    .returning();
  return row;
}

export interface LeaderboardAgg {
  provider: string;
  model: string;
  total: number;
  success: number;
  error: number;
  avgLatencyMs: number | null;
  lastUsedAt: string | null;
}

export async function getModelLeaderboard(
  ctx: TenantContext,
  days: number
): Promise<LeaderboardAgg[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await ctx.tenantScopedDb
    .select({
      provider: schema.modelInvocation.provider,
      model: schema.modelInvocation.model,
      total: sql<number>`count(*)`.mapWith(Number),
      success:
        sql<number>`count(*) filter (where ${schema.modelInvocation.status} = 'success')`.mapWith(
          Number
        ),
      error:
        sql<number>`count(*) filter (where ${schema.modelInvocation.status} = 'error')`.mapWith(
          Number
        ),
      avgLatencyMs: sql<number | null>`avg(${schema.modelInvocation.latencyMs})`.mapWith(Number),
      lastUsedAt: sql<string | null>`max(${schema.modelInvocation.createdAt})`,
    })
    .from(schema.modelInvocation)
    .where(
      and(
        eq(schema.modelInvocation.tenantId, ctx.tenantId),
        gte(schema.modelInvocation.createdAt, since)
      )
    )
    .groupBy(schema.modelInvocation.provider, schema.modelInvocation.model)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    total: r.total,
    success: r.success,
    error: r.error,
    avgLatencyMs: r.avgLatencyMs,
    lastUsedAt: r.lastUsedAt,
  }));
}
