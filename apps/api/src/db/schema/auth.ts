import { pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { userAccount } from './user';

/**
 * Global identity lookup table (NO RLS) used during authentication to resolve
 * a Supertokens user id to a Mimir user account and default tenant before a
 * tenant transaction context exists.
 */
export const externalIdentity = pgTable(
  'external_identity',
  {
    externalId: varchar('external_id', { length: 255 }).notNull(),
    userAccountId: uuid('user_account_id')
      .notNull()
      .references(() => userAccount.id, { onDelete: 'cascade' }),
    defaultTenantId: uuid('default_tenant_id').references(() => tenant.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.externalId] }),
  })
);
