import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';

export const schedulingProjectStatusEnum = pgEnum('scheduling_project_status', [
  'active',
  'completed',
  'on_hold',
  'cancelled',
]);

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    client: text('client').notNull().default(''),
    deadline: timestamp('deadline', { withTimezone: true }),
    status: schedulingProjectStatusEnum('status').notNull().default('active'),
    estimatedHours: integer('estimated_hours'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('project_tenant_status_idx').on(table.tenantId, table.status),
  })
);

export const resource = pgTable(
  'resource',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull().default(''),
    weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(40),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('resource_tenant_idx').on(table.tenantId),
  })
);

export const scheduleAssignment = pgTable(
  'schedule_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resource.id, { onDelete: 'cascade' }),
    weekStarting: date('week_starting').notNull(),
    allocatedHours: integer('allocated_hours').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantWeekIdx: index('schedule_assignment_tenant_week_idx').on(
      table.tenantId,
      table.weekStarting
    ),
    resourceWeekIdx: index('schedule_assignment_resource_week_idx').on(
      table.resourceId,
      table.weekStarting
    ),
  })
);
