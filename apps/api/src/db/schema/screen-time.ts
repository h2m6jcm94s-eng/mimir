import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const screenTimeEntry = pgTable(
  'screen_time_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    app: text('app'),
    category: text('category'),
    minutes: integer('minutes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantDateIdx: index('screen_time_entry_tenant_date_idx').on(table.tenantId, table.date),
  })
);
