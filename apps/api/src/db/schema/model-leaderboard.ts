import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const modelInvocationStatusEnum = pgEnum('model_invocation_status', ['success', 'error']);

export const modelInvocation = pgTable('model_invocation', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  tier: integer('tier').notNull(),
  status: modelInvocationStatusEnum('status').notNull(),
  latencyMs: integer('latency_ms'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  costUsd: numeric('cost_usd', { precision: 18, scale: 8 }),
  errorCode: text('error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
