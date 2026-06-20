import { boolean, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { appUser } from './tenancy';

export const emailDigestFrequencyEnum = pgEnum('email_digest_frequency', ['daily', 'weekly']);

export const emailDigestPreference = pgTable(
  'email_digest_preference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    frequency: emailDigestFrequencyEnum('frequency').notNull().default('daily'),
    enabled: boolean('enabled').notNull().default(true),
    includeNotifications: boolean('include_notifications').notNull().default(true),
    includeTasks: boolean('include_tasks').notNull().default(true),
    includeApprovals: boolean('include_approvals').notNull().default(true),
    includeReports: boolean('include_reports').notNull().default(true),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('email_digest_preference_user_idx').on(table.tenantId, table.appUserId),
    dueIdx: index('email_digest_preference_due_idx').on(
      table.enabled,
      table.frequency,
      table.lastSentAt
    ),
  })
);
