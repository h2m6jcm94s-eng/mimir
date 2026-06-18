import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'slack',
  'webhook',
]);

export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);

export const notificationPriorityEnum = pgEnum('notification_priority', ['low', 'normal', 'high']);

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    priority: notificationPriorityEnum('priority').notNull().default('normal'),
    dedupKey: text('dedup_key'),
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dedupIdx: index('notification_dedup_idx').on(table.tenantId, table.dedupKey),
  })
);

export const notificationDelivery = pgTable('notification_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  notificationId: uuid('notification_id')
    .notNull()
    .references(() => notification.id, { onDelete: 'cascade' }),
  channel: notificationChannelEnum('channel').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
