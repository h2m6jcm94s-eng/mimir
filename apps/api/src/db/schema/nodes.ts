import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { userAccount } from './user';

export const nodeKindEnum = pgEnum('node_kind', ['brain', 'desktop', 'cloud', 'phone']);
export const nodeStatusEnum = pgEnum('node_status', ['up', 'degraded', 'down', 'unknown']);

export const node = pgTable('node', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  ownerUserAccountId: uuid('owner_user_account_id').references(() => userAccount.id, {
    onDelete: 'set null',
  }),
  kind: nodeKindEnum('kind').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  tier: integer('tier').notNull(),
  tailnetAddr: text('tailnet_addr'),
  publicKey: text('public_key'),
  apiKeyHash: varchar('api_key_hash', { length: 255 }),
  status: nodeStatusEnum('status').notNull().default('unknown'),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
