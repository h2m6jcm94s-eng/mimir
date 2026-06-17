import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const policy = pgTable('policy', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('default'),
  source: text('source').notNull(),
  version: text('version').notNull().default('1'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
