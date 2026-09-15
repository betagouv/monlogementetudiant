import { bigint, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'

export const bailleurAccommodationScopes = pgTable(
  'bailleur_accommodation_scope',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bailleur_accommodation_scope_user_accommodation_idx').on(t.userId, t.accommodationId),
    index('bailleur_accommodation_scope_user_id_idx').on(t.userId),
    index('bailleur_accommodation_scope_accommodation_id_idx').on(t.accommodationId),
  ],
)
