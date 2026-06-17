import { desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function getActivePolicy(
  ctx: TenantContext
): Promise<typeof schema.policy.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.policy)
    .where(eq(schema.policy.enabled, true))
    .orderBy(desc(schema.policy.updatedAt))
    .limit(1);
  return row;
}

export async function upsertPolicy(
  ctx: TenantContext,
  input: { name?: string; source: string; version?: string }
): Promise<typeof schema.policy.$inferSelect> {
  const existing = await getActivePolicy(ctx);
  if (existing) {
    const [row] = await ctx.tenantScopedDb
      .update(schema.policy)
      .set({
        name: input.name ?? existing.name,
        source: input.source,
        version: input.version ?? existing.version,
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.policy.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await ctx.tenantScopedDb
    .insert(schema.policy)
    .values({
      tenantId: ctx.tenantId,
      name: input.name ?? 'default',
      source: input.source,
      version: input.version ?? '1',
      enabled: true,
    })
    .returning();
  return row;
}
