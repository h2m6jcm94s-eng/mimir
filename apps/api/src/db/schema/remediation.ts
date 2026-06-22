import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const remediationStatusEnum = pgEnum('remediation_status', [
  'pending',
  'running',
  'resolved',
  'failed',
]);

export const remediationRun = pgTable(
  'remediation_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    issue: text('issue').notNull(),
    action: text('action'),
    status: remediationStatusEnum('status').notNull().default('pending'),
    output: jsonb('output').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('remediation_run_tenant_status_idx').on(table.tenantId, table.status),
  })
);
