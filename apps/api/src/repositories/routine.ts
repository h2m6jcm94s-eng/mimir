import type { CreateRoutineRequest, UpdateRoutineRequest } from '@mimir/shared-types';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function createRoutine(
  ctx: TenantContext,
  input: CreateRoutineRequest,
  createdBy?: string
): Promise<typeof schema.routine.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.routine)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description,
      cron: input.cron ?? '',
      jobType: input.jobType,
      jobInput: input.jobInput,
      tier: input.tier,
      enabled: input.enabled,
      sourceFormat: input.sourceFormat,
      workflowJson: input.workflowJson,
      nodeId: input.nodeId,
      createdBy,
    })
    .returning();
  return row;
}

export async function listRoutines(
  ctx: TenantContext,
  options: { enabled?: boolean; limit?: number; cursor?: string } = {}
): Promise<(typeof schema.routine.$inferSelect)[]> {
  const conditions = [eq(schema.routine.tenantId, ctx.tenantId)];
  if (options.enabled !== undefined) {
    conditions.push(eq(schema.routine.enabled, options.enabled));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.routine)
    .where(and(...conditions))
    .orderBy(desc(schema.routine.createdAt))
    .limit(options.limit ?? 100);
}

export async function getRoutineById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.routine.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.routine)
    .where(and(eq(schema.routine.id, id), eq(schema.routine.tenantId, ctx.tenantId)));
  return row;
}

export async function updateRoutine(
  ctx: TenantContext,
  id: string,
  input: UpdateRoutineRequest
): Promise<typeof schema.routine.$inferSelect | undefined> {
  const existing = await getRoutineById(ctx, id);
  if (!existing) return undefined;

  const [row] = await ctx.tenantScopedDb
    .update(schema.routine)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.cron !== undefined && { cron: input.cron }),
      ...(input.jobType !== undefined && { jobType: input.jobType }),
      ...(input.jobInput !== undefined && { jobInput: input.jobInput }),
      ...(input.tier !== undefined && { tier: input.tier }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.sourceFormat !== undefined && { sourceFormat: input.sourceFormat }),
      ...(input.workflowJson !== undefined && { workflowJson: input.workflowJson }),
      ...(input.nodeId !== undefined && { nodeId: input.nodeId }),
      ...(input.optimizationLog !== undefined && {
        optimizationLog: input.optimizationLog,
        optimizedAt: new Date(),
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.routine.id, id), eq(schema.routine.tenantId, ctx.tenantId)))
    .returning();
  return row;
}

export async function deleteRoutine(ctx: TenantContext, id: string): Promise<boolean> {
  const existing = await getRoutineById(ctx, id);
  if (!existing) return false;

  await ctx.tenantScopedDb
    .delete(schema.routine)
    .where(and(eq(schema.routine.id, id), eq(schema.routine.tenantId, ctx.tenantId)));
  return true;
}

export async function createRoutineRun(
  ctx: TenantContext,
  routineId: string,
  status: 'pending' | 'running' | 'done' | 'failed' = 'pending'
): Promise<typeof schema.routineRun.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.routineRun)
    .values({
      tenantId: ctx.tenantId,
      routineId,
      status,
    })
    .returning();
  return row;
}

export async function listRoutineRuns(
  ctx: TenantContext,
  routineId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<(typeof schema.routineRun.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.routineRun)
    .where(
      and(eq(schema.routineRun.tenantId, ctx.tenantId), eq(schema.routineRun.routineId, routineId))
    )
    .orderBy(desc(schema.routineRun.createdAt))
    .limit(options.limit ?? 100);
}

export async function updateRoutineRun(
  ctx: TenantContext,
  id: string,
  update: Partial<typeof schema.routineRun.$inferSelect>
): Promise<typeof schema.routineRun.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.routineRun)
    .set(update)
    .where(and(eq(schema.routineRun.id, id), eq(schema.routineRun.tenantId, ctx.tenantId)))
    .returning();
  return row;
}

export async function updateRoutineRunStatus(
  ctx: TenantContext,
  id: string,
  status: 'pending' | 'running' | 'done' | 'failed',
  error?: { code?: string; message?: string }
): Promise<typeof schema.routineRun.$inferSelect | undefined> {
  const now = new Date();
  const [row] = await ctx.tenantScopedDb
    .update(schema.routineRun)
    .set({
      status,
      ...(status === 'running' && { startedAt: now }),
      ...(['done', 'failed'].includes(status) && { finishedAt: now }),
      ...(error?.code && { errorCode: error.code }),
      ...(error?.message && { errorMessage: error.message }),
    })
    .where(and(eq(schema.routineRun.id, id), eq(schema.routineRun.tenantId, ctx.tenantId)))
    .returning();

  if (row) {
    await ctx.tenantScopedDb
      .update(schema.routine)
      .set({
        lastRunAt: now,
        lastRunStatus: status,
        updatedAt: now,
      })
      .where(and(eq(schema.routine.id, row.routineId), eq(schema.routine.tenantId, ctx.tenantId)));
  }

  return row;
}
