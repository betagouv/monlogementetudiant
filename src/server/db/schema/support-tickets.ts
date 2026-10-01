import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

// Doit rester synchronisé avec `ESupportTicketCategory` (src/enums/support-ticket.ts).
export const supportTicketCategoryEnum = pgEnum('support_ticket_category', [
  'search',
  'contact_request',
  'student_space',
  'simulators',
  'account',
  'other',
])

// Doit rester synchronisé avec `ESupportTicketStatus` (src/enums/support-ticket.ts).
export const supportTicketStatusEnum = pgEnum('support_ticket_status', ['open', 'in_progress', 'resolved'])

/** Tickets de support ouverts par les étudiants connectés, traités depuis l'administration. */
export const supportTickets = pgTable(
  'support_ticket',
  {
    id: text().primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    category: supportTicketCategoryEnum().notNull(),
    message: text().notNull(),
    status: supportTicketStatusEnum().notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_ticket_status_created_at_idx').on(t.status, t.createdAt), index('support_ticket_user_id_idx').on(t.userId)],
)
