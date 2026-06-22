import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateSkillDraftInput {
  name: string;
  description: string;
  prompt: string;
  code?: string;
  payload?: Record<string, unknown>;
}

export async function createSkillDraft(
  ctx: TenantContext,
  input: CreateSkillDraftInput
): Promise<typeof schema.skillDraft.$inferSelect> {
  const rows = await ctx.tenantScopedDb
    .insert(schema.skillDraft)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      code: input.code ?? null,
      payload: input.payload ?? {},
    })
    .returning();
  return rows[0];
}

export async function getSkillDraftById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.skillDraft.$inferSelect | undefined> {
  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.skillDraft)
    .where(and(eq(schema.skillDraft.tenantId, ctx.tenantId), eq(schema.skillDraft.id, id)))
    .limit(1);
  return rows[0];
}

export async function listSkillDrafts(
  ctx: TenantContext,
  options: { status?: 'draft' | 'published' | 'archived'; limit?: number } = {}
): Promise<(typeof schema.skillDraft.$inferSelect)[]> {
  const conditions = [eq(schema.skillDraft.tenantId, ctx.tenantId)];
  if (options.status) {
    conditions.push(eq(schema.skillDraft.status, options.status));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.skillDraft)
    .where(and(...conditions))
    .orderBy(desc(schema.skillDraft.createdAt))
    .limit(options.limit ?? 100);
}

export async function publishSkillDraft(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.skillDraft.$inferSelect | undefined> {
  const rows = await ctx.tenantScopedDb
    .update(schema.skillDraft)
    .set({ status: 'published', updatedAt: new Date() })
    .where(and(eq(schema.skillDraft.tenantId, ctx.tenantId), eq(schema.skillDraft.id, id)))
    .returning();
  return rows[0];
}

export async function listPublishedSkillDrafts(
  ctx: TenantContext
): Promise<(typeof schema.skillDraft.$inferSelect)[]> {
  return listSkillDrafts(ctx, { status: 'published' });
}
