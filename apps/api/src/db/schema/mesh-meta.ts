import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { node } from './nodes';
import { tenant } from './tenancy';

export const meshMeta = pgTable('mesh_meta', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  leader: uuid('leader').references(() => node.id, { onDelete: 'set null' }),
  epoch: bigint('epoch', { mode: 'number' }).notNull().default(0),
  minEpoch: bigint('min_epoch', { mode: 'number' }).notNull().default(0),
  transitionState: text('transition_state').notNull().default('active'),
  leaseToken: uuid('lease_token'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
});
