import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { appUser } from './tenancy';

export const valueStatement = pgTable(
  'value_statement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    weight: integer('weight').notNull().default(5),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('value_statement_user_idx').on(table.tenantId, table.appUserId),
    activeNameIdx: index('value_statement_active_name_idx').on(
      table.tenantId,
      table.appUserId,
      table.name
    ),
  })
);

export const decision = pgTable(
  'decision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    context: text('context').notNull().default(''),
    options: jsonb('options').notNull().default('[]'),
    chosenOption: text('chosen_option').notNull(),
    valueIds: jsonb('value_ids').notNull().default('[]'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('decision_user_idx').on(table.tenantId, table.appUserId),
    decidedAtIdx: index('decision_decided_at_idx').on(table.decidedAt),
  })
);

export const decisionOutcome = pgTable(
  'decision_outcome',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => decision.id, { onDelete: 'cascade' }),
    outcome: text('outcome').notNull(),
    alignmentScore: integer('alignment_score'),
    notes: text('notes').notNull().default(''),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_outcome_decision_idx').on(table.decisionId),
  })
);
