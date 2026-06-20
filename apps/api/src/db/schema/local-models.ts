import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const localModelConfig = pgTable(
  'local_model_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    baseUrl: text('base_url').notNull().default('http://localhost:11434'),
    chatModel: text('chat_model').notNull().default('llama3.1'),
    embeddingModel: text('embedding_model').notNull().default('nomic-embed-text'),
    embeddingDimension: integer('embedding_dimension').notNull().default(768),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: uniqueIndex('local_model_config_tenant_idx').on(table.tenantId),
  })
);
