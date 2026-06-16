import { pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { appUser, tenant, userRoleEnum } from './tenancy';

/**
 * Global identity lookup table (NO RLS) used during authentication to resolve
 * a Clerk user id to a tenant/user/role before a tenant transaction context exists.
 */
export const authIdentity = pgTable(
  'auth_identity',
  {
    clerkId: varchar('clerk_id', { length: 255 }).notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clerkId] }),
  })
);
