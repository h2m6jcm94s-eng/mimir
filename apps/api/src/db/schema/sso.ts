import { jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const ssoProviderKindEnum = pgEnum('sso_provider_kind', ['saml', 'oidc', 'scim']);
export const ssoProviderStatusEnum = pgEnum('sso_provider_status', ['active', 'inactive']);

export const ssoProvider = pgTable('sso_provider', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: ssoProviderKindEnum('kind').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: ssoProviderStatusEnum('status').notNull().default('inactive'),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scimToken = pgTable('scim_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => ssoProvider.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
