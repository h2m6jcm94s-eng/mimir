import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';
import { knowledgeItem, knowledgeKindEnum } from './knowledge';
import { tenant } from './tenancy';
import { userAccount } from './user';

export const knowledgeShareStatusEnum = pgEnum('knowledge_share_status', [
  'pending',
  'approved',
  'denied',
  'revoked',
  'expired',
]);

export const knowledgeShareScopeEnum = pgEnum('knowledge_share_scope', ['search', 'read']);

const bigintIdentity = customType<{ data: number }>({
  dataType() {
    return 'bigint generated always as identity primary key';
  },
});

export const knowledgeShare = pgTable('knowledge_share', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerTenantId: uuid('provider_tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  requesterTenantId: uuid('requester_tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  knowledgeItemId: uuid('knowledge_item_id')
    .notNull()
    .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
  status: knowledgeShareStatusEnum('status').notNull().default('pending'),
  scope: knowledgeShareScopeEnum('scope').notNull().default('search'),
  tier: integer('tier').notNull().default(0),
  requestedByUserAccountId: uuid('requested_by_user_account_id')
    .notNull()
    .references(() => userAccount.id, { onDelete: 'cascade' }),
  reviewedByUserAccountId: uuid('reviewed_by_user_account_id').references(() => userAccount.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sharedKnowledgeItem = pgTable('shared_knowledge_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  shareId: uuid('share_id')
    .notNull()
    .references(() => knowledgeShare.id, { onDelete: 'cascade' }),
  sourceTenantId: uuid('source_tenant_id').notNull(),
  sourceKnowledgeItemId: uuid('source_knowledge_item_id').notNull(),
  kind: knowledgeKindEnum('kind').notNull(),
  uri: text('uri'),
  tier: integer('tier').notNull().default(0),
  hash: text('hash').notNull(),
  content: text('content'),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sharedEmbedding = pgTable('shared_embedding', {
  id: bigintIdentity('id'),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  sharedKnowledgeItemId: uuid('shared_knowledge_item_id')
    .notNull()
    .references(() => sharedKnowledgeItem.id, { onDelete: 'cascade' }),
  chunkIdx: integer('chunk_idx').notNull(),
  text: text('text').notNull(),
  vector: customType<{ data: number[] }>({
    dataType() {
      return 'vector(768)';
    },
  })('vector').notNull(),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
