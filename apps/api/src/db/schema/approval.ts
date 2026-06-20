import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { job } from './jobs';
import { tenant } from './tenancy';

export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'denied']);
export const approvalRiskEnum = pgEnum('approval_risk', ['low', 'medium', 'high']);

export const approval = pgTable('approval', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => job.id, { onDelete: 'cascade' }),
  status: approvalStatusEnum('status').notNull().default('pending'),
  risk: approvalRiskEnum('risk').notNull().default('low'),
  blastRadius: jsonb('blast_radius').notNull().default({}),
  requestedBy: text('requested_by').notNull(),
  decidedBy: text('decided_by'),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
