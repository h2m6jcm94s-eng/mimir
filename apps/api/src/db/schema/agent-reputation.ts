import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const agentReputation = pgTable('agent_reputation', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  score: integer('score').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
});
