import { bigint, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import type { EReminderType } from '~/enums/reminder-email'
import type { InactivityReason } from '~/server/bailleur/inactivity-rules'
import { accommodations } from './accommodations'
import { user } from './auth'
import { owners } from './owners'

export const reminderEmails = pgTable(
  'reminder_email',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    messageId: varchar('message_id', { length: 255 }).notNull().unique(),
    type: varchar({ length: 50 }).$type<EReminderType>().notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id, { onDelete: 'set null' }),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('reminder_email_sent_at_idx').on(table.sentAt)],
)

export const reminderEmailItems = pgTable(
  'reminder_email_item',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    reminderEmailId: bigint('reminder_email_id', { mode: 'number' })
      .notNull()
      .references(() => reminderEmails.id, { onDelete: 'cascade' }),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    reason: varchar({ length: 50 }).$type<InactivityReason>().notNull(),
  },
  (table) => [index('reminder_email_item_reminder_email_id_idx').on(table.reminderEmailId)],
)
