import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'

export const accommodationReports = pgTable(
  'accommodation_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    details: text('details'),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accommodation_report_ip_hash_created_at_idx').on(t.ipHash, t.createdAt)],
)
