import { z } from 'zod';

export const KnowledgeShareStatus = z.enum(['pending', 'approved', 'denied', 'revoked', 'expired']);
export type KnowledgeShareStatus = z.infer<typeof KnowledgeShareStatus>;

export const KnowledgeShareScope = z.enum(['search', 'read']);
export type KnowledgeShareScope = z.infer<typeof KnowledgeShareScope>;

export const KnowledgeShare = z.object({
  id: z.string().uuid(),
  providerTenantId: z.string().uuid(),
  requesterTenantId: z.string().uuid(),
  knowledgeItemId: z.string().uuid(),
  status: KnowledgeShareStatus,
  scope: KnowledgeShareScope,
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  requestedByUserAccountId: z.string().uuid(),
  reviewedByUserAccountId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeShare = z.infer<typeof KnowledgeShare>;

export const SharedKnowledgeItem = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shareId: z.string().uuid(),
  sourceTenantId: z.string().uuid(),
  sourceKnowledgeItemId: z.string().uuid(),
  kind: z.enum(['doc', 'code', 'screenshot', 'web']),
  uri: z.string().optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  hash: z.string(),
  content: z.string().optional(),
  meta: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SharedKnowledgeItem = z.infer<typeof SharedKnowledgeItem>;

export const SharedEmbedding = z.object({
  id: z.number().int(),
  tenantId: z.string().uuid(),
  sharedKnowledgeItemId: z.string().uuid(),
  chunkIdx: z.number().int(),
  text: z.string(),
  vector: z.array(z.number()).length(768),
  meta: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type SharedEmbedding = z.infer<typeof SharedEmbedding>;

export const CreateKnowledgeShareRequest = z.object({
  providerTenantId: z.string().uuid(),
  knowledgeItemId: z.string().uuid(),
  scope: KnowledgeShareScope.default('search'),
  expiresAt: z.string().datetime().optional(),
});
export type CreateKnowledgeShareRequest = z.infer<typeof CreateKnowledgeShareRequest>;

export const KnowledgeShareActionRequest = z.object({
  reason: z.string().max(500).optional(),
});
export type KnowledgeShareActionRequest = z.infer<typeof KnowledgeShareActionRequest>;

export const ListKnowledgeSharesQuery = z.object({
  direction: z.enum(['incoming', 'outgoing', 'all']).default('all'),
  status: KnowledgeShareStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type ListKnowledgeSharesQuery = z.infer<typeof ListKnowledgeSharesQuery>;

export const SearchKnowledgeWithSharesQuery = z.object({
  q: z.string().min(1),
  includeShared: z.coerce.boolean().default(false),
  tier: z.coerce.number().int().min(0).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type SearchKnowledgeWithSharesQuery = z.infer<typeof SearchKnowledgeWithSharesQuery>;

export const SearchKnowledgeResultItem = z.object({
  knowledgeItemId: z.string().uuid(),
  chunkIdx: z.number().int(),
  text: z.string(),
  score: z.number(),
  kind: z.enum(['doc', 'code', 'screenshot', 'web']),
  uri: z.string().nullable(),
  citation: z.string().nullable().optional(),
  sharedFromTenantId: z.string().uuid().optional(),
});
export type SearchKnowledgeResultItem = z.infer<typeof SearchKnowledgeResultItem>;
