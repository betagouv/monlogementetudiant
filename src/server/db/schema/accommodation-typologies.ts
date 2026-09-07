import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'

// Typology types — kept in sync with TYPOLOGY_TYPES in src/schemas/accommodations/create-residence.ts.
// Values mirror the domain `ZTypology.type` so child rows map 1:1 to the domain model.
export const typologyTypeEnum = pgEnum('accommodation_typology_type', ['t1', 't1_bis', 't2', 't3', 't4', 't5', 't6', 't7_more'])

export const accommodationTypologies = pgTable(
  'accommodation_typology',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    type: typologyTypeEnum('type').notNull(),
    priceMin: integer('price_min'),
    priceMax: integer('price_max'),
    superficieMin: integer('superficie_min'),
    superficieMax: integer('superficie_max'),
    nbTotal: integer('nb_total'),
    nbAvailable: integer('nb_available'),
    colocation: boolean('colocation').notNull().default(false),

    availabilityUpdatedAt: timestamp('availability_updated_at', { withTimezone: true }),
    availabilityUpdatedBy: text('availability_updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [
    unique('accommodation_typology_accommodation_id_type_unique').on(t.accommodationId, t.type),
    index('accommodation_typology_accommodation_id_idx').on(t.accommodationId),
  ],
)
