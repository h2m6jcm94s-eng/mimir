import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { userAccount } from './user';

export const chatChannel = pgTable(
  'chat_channel',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdByUserAccountId: uuid('created_by_user_account_id')
      .notNull()
      .references(() => userAccount.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('chat_channel_tenant_idx').on(table.tenantId),
  })
);

export const chatParticipant = pgTable(
  'chat_participant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => chatChannel.id, { onDelete: 'cascade' }),
    userAccountId: uuid('user_account_id')
      .notNull()
      .references(() => userAccount.id, { onDelete: 'cascade' }),
    encryptedChannelKey: text('encrypted_channel_key').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelIdx: index('chat_participant_channel_idx').on(table.channelId),
    userIdx: index('chat_participant_user_idx').on(table.tenantId, table.userAccountId),
  })
);

export const chatMessage = pgTable(
  'chat_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => chatChannel.id, { onDelete: 'cascade' }),
    senderUserAccountId: uuid('sender_user_account_id')
      .notNull()
      .references(() => userAccount.id, { onDelete: 'cascade' }),
    encryptedPayload: jsonb('encrypted_payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index('chat_message_channel_created_idx').on(
      table.channelId,
      table.createdAt
    ),
  })
);
