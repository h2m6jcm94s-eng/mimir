import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const skillDraftStatusEnum = pgEnum('skill_draft_status', [
  'draft',
  'published',
  'archived',
]);

export const skillDraft = pgTable(
  'skill_draft',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    prompt: text('prompt').notNull(),
    code: text('code'),
    payload: jsonb('payload').notNull().default({}),
    status: skillDraftStatusEnum('status').notNull().default('draft'),
    installs: integer('installs').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('skill_draft_tenant_status_idx').on(table.tenantId, table.status),
  })
);
