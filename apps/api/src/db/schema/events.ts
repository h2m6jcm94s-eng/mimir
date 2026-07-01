import { jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { job } from './jobs';
import { tenant } from './tenancy';

export const jobEventTypeEnum = pgEnum('job_event_type', [
  'job.created',
  'job.queued',
  'job.blocked',
  'job.running',
  'job.build.completed',
  'job.review.completed',
  'job.patch.applied',
  'job.apply.completed',
  'job.apply.failed',
  'job.done',
  'job.failed',
  'job.cancelled',
  'job.retried',
  'job.status_updated',
  'job.approval.requested',
  'cloud_worker.returned',
]);

export const jobEvent = pgTable('job_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => job.id, { onDelete: 'cascade' }),
  type: jobEventTypeEnum('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
