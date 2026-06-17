import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const connectorKindEnum = pgEnum('connector_kind', ['github']);
export const connectorStatusEnum = pgEnum('connector_status', [
  'connected',
  'disconnected',
  'error',
]);

export const connector = pgTable('connector', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: connectorKindEnum('kind').notNull(),
  account: text('account'),
  scopes: text('scopes').array().default([]),
  tier: integer('tier').notNull().default(1),
  status: connectorStatusEnum('status').notNull().default('disconnected'),
  secretRef: text('secret_ref'),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
