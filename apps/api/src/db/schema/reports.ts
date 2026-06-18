import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const reportKindEnum = pgEnum('report_kind', ['security', 'cost', 'compliance']);
export const reportStatusEnum = pgEnum('report_status', ['ready', 'generating', 'scheduled']);

export const report = pgTable(
  'report',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    kind: reportKindEnum('kind').notNull(),
    status: reportStatusEnum('status').notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantKindIdx: index('report_tenant_kind_idx').on(table.tenantId, table.kind),
    tenantStatusIdx: index('report_tenant_status_idx').on(table.tenantId, table.status),
  })
);
