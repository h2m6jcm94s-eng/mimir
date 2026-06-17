import { boolean, integer, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const budget = pgTable('budget', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' })
    .unique(),
  dailyBudgetUsd: integer('daily_budget_usd').notNull().default(0),
  monthlyBudgetUsd: integer('monthly_budget_usd').notNull().default(0),
  throttleThreshold: numeric('throttle_threshold', { precision: 3, scale: 2 })
    .notNull()
    .default('0.8'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
