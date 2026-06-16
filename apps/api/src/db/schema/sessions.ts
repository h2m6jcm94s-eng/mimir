import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system', 'tool']);
export const sessionSourceEnum = pgEnum('session_source', [
  'web',
  'telegram',
  'discord',
  'slack',
  'cli',
  'api',
]);

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  source: sessionSourceEnum('source').notNull(),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const message = pgTable('message', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  platformMessageId: text('platform_message_id'),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  model: text('model'),
  tier: integer('tier').notNull().default(0),
  tokensIn: integer('tokens_in').default(0),
  tokensOut: integer('tokens_out').default(0),
  costUsd: integer('cost_usd').default(0),
  sources: text('sources'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
