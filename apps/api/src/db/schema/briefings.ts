import { integer, jsonb, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const briefingKindEnum = pgEnum('briefing_kind', ['briefing', 'email', 'meeting']);

export const briefing = pgTable('briefing', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: briefingKindEnum('kind').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  tier: integer('tier').notNull().default(1),
  confidence: real('confidence').notNull().default(0.9),
  sources: integer('sources'),
  payload: jsonb('payload').default({}),
  pinned: text('pinned'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
