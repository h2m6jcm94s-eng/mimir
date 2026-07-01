import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './tenancy';
import { tenant } from './tenancy';

export const companionMoodEnum = pgEnum('companion_mood', [
  'great',
  'good',
  'okay',
  'low',
  'rough',
]);

export const companionCheckIn = pgTable('companion_check_in', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  mood: companionMoodEnum('mood').notNull(),
  note: text('note'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
