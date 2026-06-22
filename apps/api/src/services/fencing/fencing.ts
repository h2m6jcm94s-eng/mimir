import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';

export class StaleEpochError extends Error {
  constructor(message = 'Stale epoch: write rejected') {
    super(message);
    this.name = 'StaleEpochError';
  }
}

export class ReadOnlyError extends Error {
  constructor(message = 'Node is read-only: write rejected') {
    super(message);
    this.name = 'ReadOnlyError';
  }
}

export class PromotionInProgressError extends Error {
  constructor(message = 'A promotion is already in progress') {
    super(message);
    this.name = 'PromotionInProgressError';
  }
}

type MeshMetaRow = typeof schema.meshMeta.$inferSelect;

export async function getEpoch(ctx: TenantContext): Promise<number> {
  const [meta] = await ctx.tenantScopedDb
    .select({ epoch: schema.meshMeta.epoch })
    .from(schema.meshMeta)
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId));
  return meta?.epoch ?? 0;
}

async function getMeshMeta(
  ctx: TenantContext,
  options?: { lock: boolean }
): Promise<MeshMetaRow | undefined> {
  const query = ctx.tenantScopedDb
    .select()
    .from(schema.meshMeta)
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId));
  const lockedQuery = options?.lock ? query.for('update') : query;
  const [meta] = await lockedQuery;
  return meta;
}

function advisoryLockKey(tenantId: string): number {
  // Map the tenant UUID to a signed 32-bit integer for pg_advisory_xact_lock.
  const hash = Buffer.from(tenantId).reduce((h, byte) => (h * 31 + byte) | 0, 0);
  return Math.abs(hash) % 2_147_483_647;
}

async function acquireAdvisoryLock(ctx: TenantContext): Promise<void> {
  await ctx.tenantScopedDb.execute(
    sql`SELECT pg_advisory_xact_lock(${advisoryLockKey(ctx.tenantId)})`
  );
}

export async function bumpEpoch(
  ctx: TenantContext,
  expectedEpoch: number,
  leaderNodeId?: string
): Promise<number | null> {
  await acquireAdvisoryLock(ctx);

  const existing = await getMeshMeta(ctx);

  if (!existing) {
    // First write for this tenant. Use an upsert so concurrent initial bumps are idempotent.
    const [inserted] = await ctx.tenantScopedDb
      .insert(schema.meshMeta)
      .values({
        tenantId: ctx.tenantId,
        epoch: 1,
        minEpoch: 1,
        leader: leaderNodeId ?? null,
      })
      .onConflictDoNothing()
      .returning({ epoch: schema.meshMeta.epoch });

    if (inserted) return inserted.epoch;

    // Another caller created the row; fall through to conditional update with the row that now exists.
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.meshMeta)
    .set({
      epoch: expectedEpoch + 1,
      minEpoch: expectedEpoch + 1,
      leader: leaderNodeId ?? null,
    })
    .where(
      and(eq(schema.meshMeta.tenantId, ctx.tenantId), eq(schema.meshMeta.epoch, expectedEpoch))
    )
    .returning({ epoch: schema.meshMeta.epoch });

  return updated?.epoch ?? null;
}

export async function acquirePromotionLease(
  ctx: TenantContext,
  candidateNodeId: string,
  ttlSeconds = 30
): Promise<{ leaseToken: string; currentEpoch: number }> {
  await acquireAdvisoryLock(ctx);

  const meta = await getMeshMeta(ctx);
  const now = new Date();

  if (meta) {
    if (meta.transitionState === 'promoting' && meta.leaseExpiresAt && meta.leaseExpiresAt > now) {
      throw new PromotionInProgressError();
    }
    if (meta.leader && meta.leader !== candidateNodeId && meta.transitionState === 'active') {
      // An active leader exists. Promotion is only safe if the caller can prove the old leader is
      // unreachable (witness proof). For now we require explicit demotion first; the phone-witness
      // is not allowed to be the sole tiebreaker.
      throw new ReadOnlyError('Active leader must be demoted before another node can promote');
    }
  }

  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const currentEpoch = meta?.epoch ?? 0;

  if (meta) {
    await ctx.tenantScopedDb
      .update(schema.meshMeta)
      .set({
        transitionState: 'promoting',
        leaseToken,
        leaseExpiresAt,
      })
      .where(eq(schema.meshMeta.tenantId, ctx.tenantId));
  } else {
    await ctx.tenantScopedDb.insert(schema.meshMeta).values({
      tenantId: ctx.tenantId,
      epoch: 0,
      minEpoch: 0,
      transitionState: 'promoting',
      leaseToken,
      leaseExpiresAt,
    });
  }

  return { leaseToken, currentEpoch };
}

export async function completePromotion(
  ctx: TenantContext,
  candidateNodeId: string,
  leaseToken: string
): Promise<number> {
  await acquireAdvisoryLock(ctx);

  const meta = await getMeshMeta(ctx);
  const now = new Date();

  if (!meta) {
    throw new PromotionInProgressError('No promotion state found');
  }
  if (meta.transitionState !== 'promoting') {
    throw new PromotionInProgressError('Promotion is not in progress');
  }
  if (meta.leaseToken !== leaseToken) {
    throw new PromotionInProgressError('Lease token mismatch');
  }
  if (!meta.leaseExpiresAt || meta.leaseExpiresAt <= now) {
    throw new PromotionInProgressError('Promotion lease has expired');
  }

  const newEpoch = await bumpEpoch(ctx, meta.epoch, candidateNodeId);
  if (newEpoch === null) {
    throw new StaleEpochError('Epoch changed during promotion');
  }

  await ctx.tenantScopedDb
    .update(schema.meshMeta)
    .set({
      leader: candidateNodeId,
      transitionState: 'active',
      leaseToken: null,
      leaseExpiresAt: null,
    })
    .where(eq(schema.meshMeta.tenantId, ctx.tenantId));

  return newEpoch;
}

export async function demoteLeader(
  ctx: TenantContext,
  nodeId: string
): Promise<{ demoted: boolean; epoch: number }> {
  await acquireAdvisoryLock(ctx);

  const meta = await getMeshMeta(ctx);
  if (!meta) {
    return { demoted: false, epoch: 0 };
  }

  if (meta.leader !== nodeId) {
    return { demoted: false, epoch: meta.epoch };
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.meshMeta)
    .set({ transitionState: 'read_only' })
    .where(and(eq(schema.meshMeta.tenantId, ctx.tenantId), eq(schema.meshMeta.leader, nodeId)))
    .returning({ epoch: schema.meshMeta.epoch });

  return { demoted: Boolean(updated), epoch: updated?.epoch ?? meta.epoch };
}

export async function assertCanWrite(
  ctx: TenantContext,
  claimedEpoch: number,
  nodeId?: string
): Promise<void> {
  // Lock the mesh_meta row so the epoch cannot advance between the check and the subsequent write.
  const meta = await getMeshMeta(ctx, { lock: true });
  const currentEpoch = meta?.epoch ?? 0;

  if (claimedEpoch < currentEpoch) {
    throw new StaleEpochError(
      `Claimed epoch ${claimedEpoch} is behind current epoch ${currentEpoch}`
    );
  }

  if (meta?.transitionState === 'read_only') {
    throw new ReadOnlyError('Tenant is in read-only transition state');
  }

  if (meta?.transitionState === 'promoting') {
    throw new ReadOnlyError('Tenant is promoting a new leader');
  }

  if (nodeId && meta?.leader && meta.leader !== nodeId) {
    throw new ReadOnlyError('This node is not the current leader');
  }
}

export async function assertCurrentEpoch(ctx: TenantContext, claimedEpoch: number): Promise<void> {
  // Kept for backwards compatibility; prefer assertCanWrite for new writes.
  await assertCanWrite(ctx, claimedEpoch);
}

export async function updateJobWithEpochCheck(
  ctx: TenantContext,
  jobId: string,
  claimedEpoch: number,
  update: Partial<typeof schema.job.$inferInsert>
) {
  await assertCanWrite(ctx, claimedEpoch);

  const [updated] = await ctx.tenantScopedDb
    .update(schema.job)
    .set({ ...update, epoch: claimedEpoch, updatedAt: new Date() })
    .where(eq(schema.job.id, jobId))
    .returning();

  return updated;
}
