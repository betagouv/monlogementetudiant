import { bigint, integer, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'

/**
 * Mémoire du détecteur d'alertes : dernière disponibilité totale observée par résidence.
 * Permet de comparer l'état courant à l'état précédent pour détecter une hausse de dispo.
 *
 * `availableCount` :
 *   - `null`  → disponibilité non-renseignée (aucune typologie n'a de disponibilité renseignée)
 *   - entier  → somme des logements disponibles tous types confondus
 */
export const alertAvailabilitySnapshots = pgTable('alert_availability_snapshot', {
  accommodationId: bigint('accommodation_id', { mode: 'number' })
    .primaryKey()
    .references(() => accommodations.id, { onDelete: 'cascade' }),
  availableCount: integer('available_count'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
