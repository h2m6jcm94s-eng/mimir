import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateValueStatementInput {
  appUserId: string;
  name: string;
  description: string;
  weight: number;
}

export interface UpdateValueStatementInput {
  name?: string;
  description?: string;
  weight?: number;
}

export interface CreateDecisionInput {
  appUserId: string;
  title: string;
  context: string;
  options: { label: string; description: string }[];
  chosenOption: string;
  valueIds: string[];
  decidedAt?: Date;
}

export interface CreateDecisionOutcomeInput {
  decisionId: string;
  outcome: string;
  alignmentScore?: number;
  notes: string;
}

export async function listValueStatements(ctx: TenantContext, appUserId: string) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.valueStatement)
    .where(
      and(
        eq(schema.valueStatement.tenantId, ctx.tenantId),
        eq(schema.valueStatement.appUserId, appUserId),
        eq(schema.valueStatement.active, true)
      )
    )
    .orderBy(schema.valueStatement.name);
}

export async function getValueStatementById(ctx: TenantContext, id: string) {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.valueStatement)
    .where(and(eq(schema.valueStatement.tenantId, ctx.tenantId), eq(schema.valueStatement.id, id)));
  return row;
}

export async function createValueStatement(ctx: TenantContext, input: CreateValueStatementInput) {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.valueStatement)
    .values({
      tenantId: ctx.tenantId,
      ...input,
    })
    .returning();
  return row;
}

export async function updateValueStatement(
  ctx: TenantContext,
  id: string,
  input: UpdateValueStatementInput
) {
  const [row] = await ctx.tenantScopedDb
    .update(schema.valueStatement)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.valueStatement.tenantId, ctx.tenantId), eq(schema.valueStatement.id, id)))
    .returning();
  return row;
}

export async function archiveValueStatement(ctx: TenantContext, id: string) {
  const [row] = await ctx.tenantScopedDb
    .update(schema.valueStatement)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(schema.valueStatement.tenantId, ctx.tenantId), eq(schema.valueStatement.id, id)))
    .returning();
  return row;
}

export async function listDecisions(ctx: TenantContext, appUserId: string) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.decision)
    .where(
      and(eq(schema.decision.tenantId, ctx.tenantId), eq(schema.decision.appUserId, appUserId))
    )
    .orderBy(desc(schema.decision.decidedAt));
}

export async function getDecisionById(ctx: TenantContext, id: string) {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.decision)
    .where(and(eq(schema.decision.tenantId, ctx.tenantId), eq(schema.decision.id, id)));
  return row;
}

export async function createDecision(ctx: TenantContext, input: CreateDecisionInput) {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.decision)
    .values({
      tenantId: ctx.tenantId,
      ...input,
      decidedAt: input.decidedAt ?? new Date(),
    })
    .returning();
  return row;
}

export async function createDecisionOutcome(ctx: TenantContext, input: CreateDecisionOutcomeInput) {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.decisionOutcome)
    .values({
      ...input,
    })
    .returning();
  return row;
}

export async function getDecisionOutcomes(ctx: TenantContext, decisionId: string) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.decisionOutcome)
    .where(eq(schema.decisionOutcome.decisionId, decisionId))
    .orderBy(desc(schema.decisionOutcome.recordedAt));
}
