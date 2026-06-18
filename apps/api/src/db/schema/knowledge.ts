import {
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const knowledgeKindEnum = pgEnum('knowledge_kind', [
  'doc',
  'code',
  'screenshot',
  'web',
  'note',
]);

const bigintIdentity = customType<{ data: number }>({
  dataType() {
    return 'bigint generated always as identity primary key';
  },
});

export const knowledgeItem = pgTable('knowledge_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: knowledgeKindEnum('kind').notNull(),
  uri: text('uri'),
  tier: integer('tier').notNull().default(0),
  hash: text('hash').notNull(),
  content: text('content'),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeLink = pgTable('knowledge_link', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id')
    .notNull()
    .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('link'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const embedding = pgTable('embedding', {
  id: bigintIdentity('id'),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  knowledgeItemId: uuid('knowledge_item_id')
    .notNull()
    .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
  chunkIdx: integer('chunk_idx').notNull(),
  text: text('text').notNull(),
  vector: vector('vector', { dimensions: 768 }).notNull(),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
