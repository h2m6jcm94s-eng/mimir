import { boolean, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { userAccount } from './user';

export const planEnum = pgEnum('plan', ['free', 'pro', 'enterprise']);
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'manager', 'member', 'viewer']);

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserAccountId: uuid('owner_user_account_id')
    .notNull()
    .references(() => userAccount.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenant = pgTable('tenant', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  plan: planEnum('plan').notNull().default('free'),
  demoExpiresAt: timestamp('demo_expires_at', { withTimezone: true }),
  isDemoLocked: boolean('is_demo_locked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  userAccountId: uuid('user_account_id')
    .notNull()
    .references(() => userAccount.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
