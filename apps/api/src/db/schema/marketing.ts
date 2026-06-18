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

export const marketingCampaignStatusEnum = pgEnum('marketing_campaign_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const marketingCalendarStatusEnum = pgEnum('marketing_calendar_status', [
  'draft',
  'scheduled',
  'published',
]);

export const marketingPlatformEnum = pgEnum('marketing_platform', [
  'blog',
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'email',
  'ad',
]);

export const brandVoice = pgTable(
  'brand_voice',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tone: text('tone').notNull().default(''),
    audience: text('audience').notNull().default(''),
    guidelines: text('guidelines').notNull().default(''),
    sampleText: text('sample_text').notNull().default(''),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ tenantIdx: index('brand_voice_tenant_idx').on(table.tenantId) })
);

export const campaign = pgTable(
  'campaign',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    brandVoiceId: uuid('brand_voice_id').references(() => brandVoice.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    goal: text('goal').notNull().default(''),
    status: marketingCampaignStatusEnum('status').notNull().default('draft'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    budget: integer('budget'),
    metrics: jsonb('metrics').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('campaign_tenant_status_idx').on(table.tenantId, table.status),
  })
);

export const contentCalendarItem = pgTable(
  'content_calendar_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaign.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    platform: marketingPlatformEnum('platform').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: marketingCalendarStatusEnum('status').notNull().default('draft'),
    tier: integer('tier').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('content_calendar_item_tenant_status_idx').on(
      table.tenantId,
      table.status
    ),
    scheduledIdx: index('content_calendar_item_scheduled_idx').on(
      table.tenantId,
      table.scheduledAt
    ),
  })
);
