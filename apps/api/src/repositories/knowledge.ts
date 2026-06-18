import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateKnowledgeItemInput {
  kind: (typeof schema.knowledgeKindEnum.enumValues)[number];
  uri?: string | null;
  tier?: number;
  hash: string;
  content?: string | null;
  meta?: Record<string, unknown>;
}

export interface CreateEmbeddingInput {
  knowledgeItemId: string;
  chunkIdx: number;
  text: string;
  vector: number[];
  meta?: Record<string, unknown>;
}

export interface SearchKnowledgeInput {
  query: string;
  limit?: number;
}

export interface SearchKnowledgeResult {
  knowledgeItemId: string;
  chunkIdx: number;
  text: string;
  score: number;
  kind: string;
  uri: string | null;
}

export async function createKnowledgeItem(
  ctx: TenantContext,
  input: CreateKnowledgeItemInput
): Promise<typeof schema.knowledgeItem.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.knowledgeItem)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      uri: input.uri,
      tier: input.tier ?? 0,
      hash: input.hash,
      content: input.content,
      meta: input.meta ?? {},
    })
    .returning();
  return row;
}

export async function createEmbeddings(
  ctx: TenantContext,
  embeddings: CreateEmbeddingInput[]
): Promise<(typeof schema.embedding.$inferSelect)[]> {
  if (embeddings.length === 0) return [];

  const rows = await ctx.tenantScopedDb
    .insert(schema.embedding)
    .values(
      embeddings.map((e) => ({
        tenantId: ctx.tenantId,
        knowledgeItemId: e.knowledgeItemId,
        chunkIdx: e.chunkIdx,
        text: e.text,
        vector: sql`${JSON.stringify(e.vector)}::vector(768)`,
        meta: e.meta ?? {},
      }))
    )
    .returning();
  return rows;
}

export async function getKnowledgeItemById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.knowledgeItem.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeItem)
    .where(and(eq(schema.knowledgeItem.id, id), eq(schema.knowledgeItem.tenantId, ctx.tenantId)));
  return row;
}

export async function getEmbeddingsByKnowledgeItemId(
  ctx: TenantContext,
  knowledgeItemId: string
): Promise<(typeof schema.embedding.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.embedding)
    .where(
      and(
        eq(schema.embedding.knowledgeItemId, knowledgeItemId),
        eq(schema.embedding.tenantId, ctx.tenantId)
      )
    );
}

export async function listKnowledgeItems(ctx: TenantContext, input: { limit: number }) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeItem)
    .where(eq(schema.knowledgeItem.tenantId, ctx.tenantId))
    .orderBy(desc(schema.knowledgeItem.createdAt))
    .limit(input.limit);
}

export async function searchKnowledge(
  ctx: TenantContext,
  input: SearchKnowledgeInput
): Promise<{ data: SearchKnowledgeResult[] }> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const tsQuery = sql`plainto_tsquery('english', ${input.query})`;
  const tsVector = sql`to_tsvector('english', ${schema.embedding.text})`;
  const rank = sql<number>`ts_rank_cd(${tsVector}, ${tsQuery})`.as('score');

  // TODO: add vector similarity search once a real embedding provider is wired in.
  // For the foundational release, full-text search is sufficient.

  const rows = await ctx.tenantScopedDb
    .select({
      knowledgeItemId: schema.embedding.knowledgeItemId,
      chunkIdx: schema.embedding.chunkIdx,
      text: schema.embedding.text,
      score: rank,
      kind: schema.knowledgeItem.kind,
      uri: schema.knowledgeItem.uri,
    })
    .from(schema.embedding)
    .innerJoin(schema.knowledgeItem, eq(schema.embedding.knowledgeItemId, schema.knowledgeItem.id))
    .where(
      and(
        eq(schema.embedding.tenantId, ctx.tenantId),
        eq(schema.knowledgeItem.tenantId, ctx.tenantId),
        sql`${tsVector} @@ ${tsQuery}`
      )
    )
    .orderBy(desc(rank))
    .limit(limit);

  return { data: rows };
}

export async function findNoteByTitle(
  ctx: TenantContext,
  title: string
): Promise<typeof schema.knowledgeItem.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(
        eq(schema.knowledgeItem.tenantId, ctx.tenantId),
        eq(schema.knowledgeItem.kind, 'note'),
        sql`${schema.knowledgeItem.meta}->>'title' = ${title}`
      )
    )
    .limit(1);
  return row;
}

export async function listNotes(ctx: TenantContext, input: { limit: number }) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(eq(schema.knowledgeItem.tenantId, ctx.tenantId), eq(schema.knowledgeItem.kind, 'note'))
    )
    .orderBy(desc(schema.knowledgeItem.createdAt))
    .limit(input.limit);
}

export interface CreateKnowledgeLinkInput {
  sourceId: string;
  targetId: string;
  kind?: string;
}

export async function createKnowledgeLink(
  ctx: TenantContext,
  input: CreateKnowledgeLinkInput
): Promise<typeof schema.knowledgeLink.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.knowledgeLink)
    .values({
      tenantId: ctx.tenantId,
      sourceId: input.sourceId,
      targetId: input.targetId,
      kind: input.kind ?? 'link',
    })
    .returning();
  return row;
}

export async function listKnowledgeLinks(
  ctx: TenantContext,
  itemId: string
): Promise<{
  outbound: (typeof schema.knowledgeLink.$inferSelect & {
    target: typeof schema.knowledgeItem.$inferSelect;
  })[];
  inbound: (typeof schema.knowledgeLink.$inferSelect & {
    source: typeof schema.knowledgeItem.$inferSelect;
  })[];
}> {
  const outboundRows = await ctx.tenantScopedDb
    .select({ link: schema.knowledgeLink, target: schema.knowledgeItem })
    .from(schema.knowledgeLink)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeLink.targetId, schema.knowledgeItem.id))
    .where(
      and(
        eq(schema.knowledgeLink.tenantId, ctx.tenantId),
        eq(schema.knowledgeLink.sourceId, itemId)
      )
    );

  const inboundRows = await ctx.tenantScopedDb
    .select({ link: schema.knowledgeLink, source: schema.knowledgeItem })
    .from(schema.knowledgeLink)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeLink.sourceId, schema.knowledgeItem.id))
    .where(
      and(
        eq(schema.knowledgeLink.tenantId, ctx.tenantId),
        eq(schema.knowledgeLink.targetId, itemId)
      )
    );

  return {
    outbound: outboundRows.map((r) => ({ ...r.link, target: r.target })),
    inbound: inboundRows.map((r) => ({ ...r.link, source: r.source })),
  };
}

export async function deleteKnowledgeLink(ctx: TenantContext, linkId: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.knowledgeLink)
    .where(
      and(eq(schema.knowledgeLink.id, linkId), eq(schema.knowledgeLink.tenantId, ctx.tenantId))
    )
    .returning();
  return result.length > 0;
}

export async function getKnowledgeGraph(ctx: TenantContext, input: { limit: number }) {
  const items = await ctx.tenantScopedDb
    .select({
      id: schema.knowledgeItem.id,
      kind: schema.knowledgeItem.kind,
      title: sql<string>`COALESCE(${schema.knowledgeItem.meta}->>'title', '')`,
    })
    .from(schema.knowledgeItem)
    .where(eq(schema.knowledgeItem.tenantId, ctx.tenantId))
    .orderBy(desc(schema.knowledgeItem.createdAt))
    .limit(input.limit);

  const itemIds = items.map((i) => i.id);
  if (itemIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const links = await ctx.tenantScopedDb
    .select({
      id: schema.knowledgeLink.id,
      sourceId: schema.knowledgeLink.sourceId,
      targetId: schema.knowledgeLink.targetId,
      kind: schema.knowledgeLink.kind,
    })
    .from(schema.knowledgeLink)
    .where(
      and(
        eq(schema.knowledgeLink.tenantId, ctx.tenantId),
        inArray(schema.knowledgeLink.sourceId, itemIds),
        inArray(schema.knowledgeLink.targetId, itemIds)
      )
    );

  return { nodes: items, edges: links };
}
