import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const toolStatusEnum = pgEnum('tool_status', ['draft', 'active', 'archived']);

export const tool = pgTable(
  'tool',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: toolStatusEnum('status').notNull().default('draft'),
    action: text('action').notNull(),
    fields: jsonb('fields').notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('tool_tenant_status_idx').on(table.tenantId, table.status),
  })
);
