import type { UpsertLocalModelConfigRequest } from '@mimir/shared-types';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function getLocalModelConfig(
  ctx: TenantContext
): Promise<typeof schema.localModelConfig.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.localModelConfig)
    .where(eq(schema.localModelConfig.tenantId, ctx.tenantId));
  return row;
}

export async function upsertLocalModelConfig(
  ctx: TenantContext,
  input: UpsertLocalModelConfigRequest
): Promise<typeof schema.localModelConfig.$inferSelect> {
  const existing = await getLocalModelConfig(ctx);
  if (existing) {
    const [row] = await ctx.tenantScopedDb
      .update(schema.localModelConfig)
      .set({
        baseUrl: input.baseUrl,
        chatModel: input.chatModel,
        embeddingModel: input.embeddingModel,
        embeddingDimension: input.embeddingDimension,
        enabled: input.enabled,
        updatedAt: new Date(),
      })
      .where(eq(schema.localModelConfig.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await ctx.tenantScopedDb
    .insert(schema.localModelConfig)
    .values({
      tenantId: ctx.tenantId,
      baseUrl: input.baseUrl,
      chatModel: input.chatModel,
      embeddingModel: input.embeddingModel,
      embeddingDimension: input.embeddingDimension,
      enabled: input.enabled,
    })
    .returning();
  return row;
}
