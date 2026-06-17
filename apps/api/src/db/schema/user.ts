import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Global user profile (NO RLS). Maps a Supertokens user id to a Mimir user account.
 * Resolved before a tenant transaction context exists.
 */
export const userAccount = pgTable('user_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
