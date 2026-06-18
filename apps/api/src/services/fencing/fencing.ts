import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';

export class StaleEpochError extends Error {
  constructor(message = 'Stale epoch: write rejected') {
    super(message);
    this.name = 'StaleEpochError';
  }
}

export async function getEpoch(ctx: TenantContext): Promise<number> {
  const [meta] = await ctx.tenantScopedDb
    .select({ epoch: schema.meshMeta.epoch })
    .from(schema.meshMeta)
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId));
  return meta?.epoch ?? 0;
}

export async function bumpEpoch(ctx: TenantContext, leaderNodeId?: string): Promise<number> {
  const existing = await ctx.tenantScopedDb
    .select({ epoch: schema.meshMeta.epoch })
    .from(schema.meshMeta)
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId));

  if (existing.length === 0) {
    await ctx.tenantScopedDb.insert(schema.meshMeta).values({
      tenantId: ctx.tenantId,
      epoch: 1,
      minEpoch: 1,
      leader: leaderNodeId ?? null,
    });
    return 1;
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.meshMeta)
    .set({
      epoch: existing[0].epoch + 1,
      minEpoch: existing[0].epoch + 1,
      leader: leaderNodeId ?? null,
    })
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId))
    .returning({ epoch: schema.meshMeta.epoch });

  return updated.epoch;
}

export async function assertCurrentEpoch(ctx: TenantContext, claimedEpoch: number): Promise<void> {
  const current = await getEpoch(ctx);
  if (claimedEpoch < current) {
    throw new StaleEpochError(`Claimed epoch ${claimedEpoch} is behind current epoch ${current}`);
  }
}

export async function updateJobWithEpochCheck(
  ctx: TenantContext,
  jobId: string,
  claimedEpoch: number,
  update: Partial<typeof schema.job.$inferInsert>
) {
  await assertCurrentEpoch(ctx, claimedEpoch);

  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(schema.job.id, jobId))
    .returning();

  return updated;
}
