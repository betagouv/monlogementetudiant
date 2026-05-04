import { sql } from 'drizzle-orm'
import { integer, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const ownerFeedbackStatusEnum = pgEnum('owner_feedback_status', ['snoozed', 'submitted'])

export const ownerFeedback = pgTable(
  'owner_feedback',
  {
    id: text().primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: ownerFeedbackStatusEnum().notNull(),
    rating: integer(),
    comment: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('owner_feedback_user_id_unique').on(t.userId)],
)
