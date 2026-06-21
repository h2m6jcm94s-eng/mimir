import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { job } from './jobs';
import { node } from './nodes';
import { appUser, tenant } from './tenancy';

export const routineSourceFormatEnum = pgEnum('routine_source_format', ['native', 'n8n']);

export const routine = pgTable(
  'routine',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    cron: text('cron').notNull().default(''),
    jobType: text('job_type').notNull(),
    jobInput: jsonb('job_input').notNull().default({}),
    tier: integer('tier').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    sourceFormat: routineSourceFormatEnum('source_format').notNull().default('native'),
    workflowJson: jsonb('workflow_json'),
    nodeId: uuid('node_id').references(() => node.id, { onDelete: 'set null' }),
    optimizedAt: timestamp('optimized_at', { withTimezone: true }),
    optimizationLog: jsonb('optimization_log'),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastRunStatus: text('last_run_status'),
    createdBy: uuid('created_by').references(() => appUser.id, { onDelete: 'set null' }),
    policyId: uuid('policy_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('routine_tenant_idx').on(table.tenantId),
    tenantEnabledIdx: index('routine_tenant_enabled_idx').on(table.tenantId, table.enabled),
    nodeIdx: index('routine_node_idx').on(table.nodeId),
  })
);

export const routineRun = pgTable(
  'routine_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routine.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => job.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    metadata: jsonb('metadata'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routineIdx: index('routine_run_routine_idx').on(table.routineId),
    tenantIdx: index('routine_run_tenant_idx').on(table.tenantId),
  })
);
