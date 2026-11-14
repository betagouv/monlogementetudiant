import { index, integer, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const brevoUnblockTriggerEnum = pgEnum('brevo_unblock_trigger', ['login', 'scheduled'])
export const brevoUnblockStatusEnum = pgEnum('brevo_unblock_status', ['success', 'error'])

export const brevoBlockedContacts = pgTable('brevo_blocked_contact', {
  email: text().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  reason: varchar({ length: 40 }),
  blockedAt: timestamp('blocked_at', { withTimezone: true }).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
})

export const brevoUnblockEvents = pgTable(
  'brevo_unblock_event',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    email: text().notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    reason: varchar({ length: 40 }),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    trigger: brevoUnblockTriggerEnum().notNull(),
    status: brevoUnblockStatusEnum().notNull(),
    error: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('brevo_unblock_event_created_at_idx').on(t.createdAt)],
)
