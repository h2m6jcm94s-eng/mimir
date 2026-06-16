import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const auditEvent = pgTable('audit_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  prevHash: varchar('prev_hash', { length: 128 }),
  hash: varchar('hash', { length: 128 }).notNull(),
  actor: varchar('actor', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  tier: integer('tier').notNull().default(0),
  payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
  sources: jsonb('sources').default([]),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
});
