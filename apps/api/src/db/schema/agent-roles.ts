import {
  boolean,
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

export const agentRoleKindEnum = pgEnum('agent_role_kind', [
  'main',
  'planner',
  'reviewer',
  'coder',
  'researcher',
  'memory',
  'executor',
  'fallback',
]);

export const agentCapabilityEnum = pgEnum('agent_capability', [
  'chat',
  'plan',
  'review',
  'code',
  'search',
  'remember',
  'act',
  'cheap',
  'fast',
  'creative',
  'long_context',
  'reasoning',
]);

export const agentRole = pgTable('agent_role', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: agentRoleKindEnum('kind').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  tier: integer('tier').notNull(),
  priority: integer('priority').notNull().default(0),
  provider: varchar('provider', { length: 32 }).notNull(),
  model: varchar('model', { length: 255 }),
  capabilities: jsonb('capabilities').notNull().default('[]'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
