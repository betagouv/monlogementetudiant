import { sql } from 'drizzle-orm'
import { bigint, boolean, geometry, index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { cities } from './cities'

export const accommodationAddresses = pgTable(
  'accommodation_address',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    isMain: boolean('is_main').notNull().default(false),
    address: varchar({ length: 255 }),
    postalCode: varchar('postal_code', { length: 5 }).notNull(),
    cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
    geom: geometry({ type: 'point', srid: 4326 }),
  },
  (t) => [
    index('accommodation_address_accommodation_id_idx').on(t.accommodationId),
    index('accommodation_address_city_id_idx').on(t.cityId),
    uniqueIndex('accommodation_address_unique_main').on(t.accommodationId).where(sql`is_main = true`),
  ],
)
