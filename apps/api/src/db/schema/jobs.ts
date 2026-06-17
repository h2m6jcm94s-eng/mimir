import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'running',
  'blocked',
  'needs_attention',
  'done',
  'failed',
]);

export const job = pgTable('job', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  workflowId: varchar('workflow_id', { length: 255 }),
  runId: varchar('run_id', { length: 255 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  tier: integer('tier').notNull().default(0),
  status: jobStatusEnum('status').notNull().default('queued'),
  input: jsonb('input'),
  result: jsonb('result'),
  epoch: integer('epoch').notNull().default(0),
  checkpoint: jsonb('checkpoint').notNull().default({}),
  costUsd: integer('cost_usd').notNull().default(0),
  priority: integer('priority').notNull().default(0),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  errorCode: varchar('error_code', { length: 64 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
