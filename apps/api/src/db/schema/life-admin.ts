import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const lifeAdminRecurrenceEnum = pgEnum('life_admin_recurrence', [
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);

export const lifeAdminStatusEnum = pgEnum('life_admin_status', ['pending', 'done']);

export const lifeAdminItem = pgTable('life_admin_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  recurrence: lifeAdminRecurrenceEnum('recurrence').notNull().default('none'),
  category: text('category'),
  status: lifeAdminStatusEnum('status').notNull().default('pending'),
  tags: text('tags').array().notNull().default([]),
  tier: integer('tier').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
