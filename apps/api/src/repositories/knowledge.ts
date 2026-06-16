import { and, desc, eq, sql } from 'drizzle-orm';
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
