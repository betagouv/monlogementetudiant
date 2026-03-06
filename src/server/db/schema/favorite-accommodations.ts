import { bigint, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'

export const favoriteAccommodations = pgTable(
  'accommodation_favoriteaccommodation',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.accommodationId)],
)
