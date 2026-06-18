import { desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateBriefingInput {
  kind: (typeof schema.briefing.$inferInsert)['kind'];
  title: string;
  summary: string;
  tier?: number;
  confidence?: number;
  sources?: number;
  payload?: Record<string, unknown>;
  pinned?: string;
}

export async function createBriefing(ctx: TenantContext, input: CreateBriefingInput) {
  const [created] = await ctx.tenantScopedDb
    .insert(schema.briefing)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      tier: input.tier ?? 1,
      confidence: input.confidence ?? 0.9,
      sources: input.sources,
      payload: input.payload,
      pinned: input.pinned,
    })
    .returning();
  return created;
}

export async function listBriefings(ctx: TenantContext, limit: number) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.briefing)
    .orderBy(desc(schema.briefing.pinned), desc(schema.briefing.createdAt))
    .limit(limit);
}

export async function getBriefing(ctx: TenantContext, id: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.briefing)
    .where(eq(schema.briefing.id, id));
  return found;
}

export async function deleteAllBriefings(ctx: TenantContext) {
  await ctx.tenantScopedDb.delete(schema.briefing);
}
