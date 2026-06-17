import { and, desc, eq, lte, or, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { createAuditEvent } from './audit';

export interface CreateShareInput {
  providerTenantId: string;
  knowledgeItemId: string;
  requestedByUserAccountId: string;
  scope?: (typeof schema.knowledgeShareScopeEnum.enumValues)[number];
  expiresAt?: Date;
}

export interface ListSharesInput {
  direction?: 'incoming' | 'outgoing' | 'all';
  status?: (typeof schema.knowledgeShareStatusEnum.enumValues)[number];
  limit?: number;
}

export interface ApproveShareInput {
  reviewedByUserAccountId: string;
  expiresAt?: Date;
}

export interface DenyShareInput {
  reviewedByUserAccountId: string;
}

export interface RevokeShareInput {
  reviewedByUserAccountId: string;
}

export interface SharedKnowledgeCopyInput {
  share: typeof schema.knowledgeShare.$inferSelect;
  item: typeof schema.knowledgeItem.$inferSelect;
  embeddings: (typeof schema.embedding.$inferSelect)[];
  actorUserAccountId: string;
}

export async function createShare(
  ctx: TenantContext,
  input: CreateShareInput
): Promise<typeof schema.knowledgeShare.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.knowledgeShare)
    .values({
      providerTenantId: input.providerTenantId,
      requesterTenantId: ctx.tenantId,
      knowledgeItemId: input.knowledgeItemId,
      status: 'pending',
      scope: input.scope ?? 'search',
      tier: 0,
      requestedByUserAccountId: input.requestedByUserAccountId,
      expiresAt: input.expiresAt,
    })
    .returning();

  await createAuditEvent(ctx, {
    actor: input.requestedByUserAccountId,
    action: 'knowledge_share_requested',
    tier: 0,
    payload: {
      shareId: row.id,
      providerTenantId: input.providerTenantId,
      requesterTenantId: ctx.tenantId,
      knowledgeItemId: input.knowledgeItemId,
      scope: input.scope ?? 'search',
    },
  });

  return row;
}

export async function getShareById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.knowledgeShare.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeShare)
    .where(
      and(
        eq(schema.knowledgeShare.id, id),
        or(
          eq(schema.knowledgeShare.providerTenantId, ctx.tenantId),
          eq(schema.knowledgeShare.requesterTenantId, ctx.tenantId)
        )
      )
    );
  return row;
}

export async function listShares(
  ctx: TenantContext,
  input: ListSharesInput = {}
): Promise<{ data: (typeof schema.knowledgeShare.$inferSelect)[] }> {
  const direction = input.direction ?? 'all';
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof or>)[] = [];

  if (direction === 'incoming') {
    conditions.push(eq(schema.knowledgeShare.providerTenantId, ctx.tenantId));
  } else if (direction === 'outgoing') {
    conditions.push(eq(schema.knowledgeShare.requesterTenantId, ctx.tenantId));
  } else {
    conditions.push(
      or(
        eq(schema.knowledgeShare.providerTenantId, ctx.tenantId),
        eq(schema.knowledgeShare.requesterTenantId, ctx.tenantId)
      )
    );
  }

  if (input.status) {
    conditions.push(eq(schema.knowledgeShare.status, input.status));
  }

  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));

  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeShare)
    .where(and(...conditions))
    .orderBy(desc(schema.knowledgeShare.createdAt))
    .limit(limit);

  return { data: rows };
}

export async function approveShare(
  ctx: TenantContext,
  shareId: string,
  input: ApproveShareInput
): Promise<typeof schema.knowledgeShare.$inferSelect> {
  const share = await getShareById(ctx, shareId);
  if (!share) {
    throw new Error('SHARE_NOT_FOUND');
  }
  if (share.providerTenantId !== ctx.tenantId) {
    throw new Error('NOT_PROVIDER');
  }
  if (share.status !== 'pending') {
    throw new Error('SHARE_NOT_PENDING');
  }

  const [item] = await ctx.tenantScopedDb
    .select({ tier: schema.knowledgeItem.tier })
    .from(schema.knowledgeItem)
    .where(
      and(
        eq(schema.knowledgeItem.id, share.knowledgeItemId),
        eq(schema.knowledgeItem.tenantId, ctx.tenantId)
      )
    );

  if (!item) {
    throw new Error('KNOWLEDGE_ITEM_NOT_FOUND');
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.knowledgeShare)
    .set({
      status: 'approved',
      reviewedByUserAccountId: input.reviewedByUserAccountId,
      expiresAt: input.expiresAt ?? share.expiresAt,
      tier: item.tier,
      updatedAt: new Date(),
    })
    .where(eq(schema.knowledgeShare.id, shareId))
    .returning();

  await createAuditEvent(ctx, {
    actor: input.reviewedByUserAccountId,
    action: 'knowledge_share_approved',
    tier: item.tier,
    payload: {
      shareId,
      providerTenantId: share.providerTenantId,
      requesterTenantId: share.requesterTenantId,
      knowledgeItemId: share.knowledgeItemId,
      tier: item.tier,
    },
  });

  return updated;
}

export async function createSharedKnowledgeCopy(
  ctx: TenantContext,
  input: SharedKnowledgeCopyInput
): Promise<void> {
  const { share, item, embeddings, actorUserAccountId } = input;

  await ctx.tenantScopedDb
    .delete(schema.sharedKnowledgeItem)
    .where(eq(schema.sharedKnowledgeItem.shareId, share.id));

  const [sharedItem] = await ctx.tenantScopedDb
    .insert(schema.sharedKnowledgeItem)
    .values({
      tenantId: ctx.tenantId,
      shareId: share.id,
      sourceTenantId: share.providerTenantId,
      sourceKnowledgeItemId: share.knowledgeItemId,
      kind: item.kind,
      uri: item.uri,
      tier: item.tier,
      hash: item.hash,
      content: item.content,
      meta: item.meta ?? {},
    })
    .returning();

  if (embeddings.length > 0) {
    await ctx.tenantScopedDb.insert(schema.sharedEmbedding).values(
      embeddings.map((e) => ({
        tenantId: ctx.tenantId,
        sharedKnowledgeItemId: sharedItem.id,
        chunkIdx: e.chunkIdx,
        text: e.text,
        vector: sql`${JSON.stringify(e.vector)}::vector(768)`,
        meta: e.meta ?? {},
      }))
    );
  }

  await createAuditEvent(ctx, {
    actor: actorUserAccountId,
    action: 'knowledge_share_accepted',
    tier: item.tier,
    payload: {
      shareId: share.id,
      providerTenantId: share.providerTenantId,
      requesterTenantId: ctx.tenantId,
      knowledgeItemId: share.knowledgeItemId,
      sharedKnowledgeItemId: sharedItem.id,
    },
  });
}

export async function denyShare(
  ctx: TenantContext,
  shareId: string,
  input: DenyShareInput
): Promise<typeof schema.knowledgeShare.$inferSelect> {
  const share = await getShareById(ctx, shareId);
  if (!share) {
    throw new Error('SHARE_NOT_FOUND');
  }
  if (share.providerTenantId !== ctx.tenantId) {
    throw new Error('NOT_PROVIDER');
  }
  if (share.status !== 'pending') {
    throw new Error('SHARE_NOT_PENDING');
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.knowledgeShare)
    .set({
      status: 'denied',
      reviewedByUserAccountId: input.reviewedByUserAccountId,
      updatedAt: new Date(),
    })
    .where(eq(schema.knowledgeShare.id, shareId))
    .returning();

  await createAuditEvent(ctx, {
    actor: input.reviewedByUserAccountId,
    action: 'knowledge_share_denied',
    tier: 0,
    payload: {
      shareId,
      providerTenantId: share.providerTenantId,
      requesterTenantId: share.requesterTenantId,
      knowledgeItemId: share.knowledgeItemId,
    },
  });

  return updated;
}

export async function deleteSharedKnowledgeCopies(
  ctx: TenantContext,
  shareId: string
): Promise<void> {
  await ctx.tenantScopedDb
    .delete(schema.sharedKnowledgeItem)
    .where(
      and(
        eq(schema.sharedKnowledgeItem.shareId, shareId),
        eq(schema.sharedKnowledgeItem.tenantId, ctx.tenantId)
      )
    );
}

export async function revokeShare(
  ctx: TenantContext,
  shareId: string,
  input: RevokeShareInput
): Promise<typeof schema.knowledgeShare.$inferSelect> {
  const share = await getShareById(ctx, shareId);
  if (!share) {
    throw new Error('SHARE_NOT_FOUND');
  }
  if (share.providerTenantId !== ctx.tenantId && share.requesterTenantId !== ctx.tenantId) {
    throw new Error('NOT_SHARE_PARTICIPANT');
  }
  if (share.status !== 'approved') {
    throw new Error('SHARE_NOT_APPROVED');
  }

  const [updated] = await ctx.tenantScopedDb
    .update(schema.knowledgeShare)
    .set({
      status: 'revoked',
      reviewedByUserAccountId: input.reviewedByUserAccountId,
      updatedAt: new Date(),
    })
    .where(eq(schema.knowledgeShare.id, shareId))
    .returning();

  await createAuditEvent(ctx, {
    actor: input.reviewedByUserAccountId,
    action: 'knowledge_share_revoked',
    tier: share.tier,
    payload: {
      shareId,
      providerTenantId: share.providerTenantId,
      requesterTenantId: share.requesterTenantId,
      knowledgeItemId: share.knowledgeItemId,
      revokedByTenantId: ctx.tenantId,
    },
  });

  return updated;
}

export interface SearchWithSharesInput {
  query: string;
  limit?: number;
  tier?: number;
}

export interface SearchWithSharesResult {
  knowledgeItemId: string;
  chunkIdx: number;
  text: string;
  score: number;
  kind: string;
  uri: string | null;
  sharedFromTenantId?: string;
}

export async function searchKnowledgeWithShares(
  ctx: TenantContext,
  input: SearchWithSharesInput
): Promise<{ data: SearchWithSharesResult[] }> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const tsQuery = sql`plainto_tsquery('english', ${input.query})`;

  const localRank =
    sql<number>`ts_rank_cd(to_tsvector('english', ${schema.embedding.text}), ${tsQuery})`.as(
      'score'
    );

  const localConditions: (
    | ReturnType<typeof eq>
    | ReturnType<typeof lte>
    | ReturnType<typeof sql>
  )[] = [
    eq(schema.embedding.tenantId, ctx.tenantId),
    eq(schema.knowledgeItem.tenantId, ctx.tenantId),
    sql`to_tsvector('english', ${schema.embedding.text}) @@ ${tsQuery}`,
  ];

  if (input.tier !== undefined) {
    localConditions.push(lte(schema.knowledgeItem.tier, input.tier));
  }

  const localRows = await ctx.tenantScopedDb
    .select({
      knowledgeItemId: schema.embedding.knowledgeItemId,
      chunkIdx: schema.embedding.chunkIdx,
      text: schema.embedding.text,
      score: localRank,
      kind: schema.knowledgeItem.kind,
      uri: schema.knowledgeItem.uri,
    })
    .from(schema.embedding)
    .innerJoin(schema.knowledgeItem, eq(schema.embedding.knowledgeItemId, schema.knowledgeItem.id))
    .where(and(...localConditions))
    .orderBy(desc(localRank))
    .limit(limit);

  const sharedRank =
    sql<number>`ts_rank_cd(to_tsvector('english', ${schema.sharedEmbedding.text}), ${tsQuery})`.as(
      'score'
    );

  const sharedConditions: (
    | ReturnType<typeof eq>
    | ReturnType<typeof lte>
    | ReturnType<typeof sql>
  )[] = [
    eq(schema.sharedEmbedding.tenantId, ctx.tenantId),
    eq(schema.sharedKnowledgeItem.tenantId, ctx.tenantId),
    sql`to_tsvector('english', ${schema.sharedEmbedding.text}) @@ ${tsQuery}`,
  ];

  if (input.tier !== undefined) {
    sharedConditions.push(lte(schema.sharedKnowledgeItem.tier, input.tier));
  }

  const sharedRows = await ctx.tenantScopedDb
    .select({
      knowledgeItemId: schema.sharedKnowledgeItem.sourceKnowledgeItemId,
      chunkIdx: schema.sharedEmbedding.chunkIdx,
      text: schema.sharedEmbedding.text,
      score: sharedRank,
      kind: schema.sharedKnowledgeItem.kind,
      uri: schema.sharedKnowledgeItem.uri,
      sharedFromTenantId: schema.sharedKnowledgeItem.sourceTenantId,
    })
    .from(schema.sharedEmbedding)
    .innerJoin(
      schema.sharedKnowledgeItem,
      eq(schema.sharedEmbedding.sharedKnowledgeItemId, schema.sharedKnowledgeItem.id)
    )
    .where(and(...sharedConditions))
    .orderBy(desc(sharedRank))
    .limit(limit);

  const merged = [...localRows, ...sharedRows].sort((a, b) => b.score - a.score).slice(0, limit);

  return { data: merged };
}
