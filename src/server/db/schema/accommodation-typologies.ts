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

    // Dernière modification du nombre de logements disponibles de cette typologie, par un
    // gestionnaire.
    //
    // Trois restrictions, toutes appliquées par `persistTypologies` (server/lib/typologies.ts) :
    // le suivi ne porte que sur `nbAvailable`, pour qu'un ajustement de loyer ne fasse pas croire
    // que les dispos ont été revues ; une typologie sans disponibilité reste à `NULL`, faute de
    // quoi la date porterait sur une donnée absente ; et seule une action de gestionnaire pose la
    // date — un import ou un script écrit la disponibilité sans toucher au suivi ni effacer la
    // trace laissée par un gestionnaire.
    //
    // `NULL` se lit donc « aucun gestionnaire n'a renseigné cette disponibilité depuis la mise en
    // place du suivi ». La migration 0058 reprend ce qui est reconstituable depuis le journal
    // d'activité, qui n'enregistre lui aussi que les actions de gestionnaire.
    availabilityUpdatedAt: timestamp('availability_updated_at', { withTimezone: true }),
    availabilityUpdatedBy: text('availability_updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [
    unique('accommodation_typology_accommodation_id_type_unique').on(t.accommodationId, t.type),
    index('accommodation_typology_accommodation_id_idx').on(t.accommodationId),
  ],
)
