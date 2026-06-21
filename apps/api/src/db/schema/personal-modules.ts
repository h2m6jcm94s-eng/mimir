import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const personalModuleKindEnum = pgEnum('personal_module_kind', [
  'finance',
  'nutrition',
  'fitness',
  'travel',
  'tutor',
  'meeting',
  'email',
  'screenTime',
  'conversation',
  'suggestion',
  'family',
  'hr',
]);

export const personalModuleStatusEnum = pgEnum('personal_module_status', [
  'active',
  'done',
  'archived',
]);

export const personalModule = pgTable('personal_module', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: personalModuleKindEnum('kind').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: personalModuleStatusEnum('status').notNull().default('active'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
