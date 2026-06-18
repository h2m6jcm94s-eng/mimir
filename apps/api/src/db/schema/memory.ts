import { jsonb, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenant } from './tenancy';
import { userAccount } from './user';

export const memoryNodeKindEnum = pgEnum('memory_node_kind', [
  'semantic',
  'episodic',
  'procedural',
]);

export const memoryNode = pgTable('memory_node', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  kind: memoryNodeKindEnum('kind').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull().default({}),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => userAccount.id, { onDelete: 'set null' }),
  sourceId: uuid('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memoryEdge = pgTable('memory_edge', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => memoryNode.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id')
    .notNull()
    .references(() => memoryNode.id, { onDelete: 'cascade' }),
  rel: text('rel').notNull().default('relates_to'),
  weight: real('weight').notNull().default(1),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memoryCheckpoint = pgTable('memory_checkpoint', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  createdBy: uuid('created_by').references(() => userAccount.id, { onDelete: 'set null' }),
  parentId: uuid('parent_id'),
  nodeSnapshot: jsonb('node_snapshot').notNull().default([]),
  edgeSnapshot: jsonb('edge_snapshot').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
