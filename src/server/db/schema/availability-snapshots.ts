import { bigint, date, index, integer, pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { owners } from './owners'

/**
 * Photo mensuelle du suivi des disponibilités par gestionnaire (cron `capture-availability-snapshot`).
 * L'état « à jour / irrégulier / non renseigné » n'est pas reconstituable a posteriori :
 * ces relevés sont la seule source de la progression dans le temps.
 */
export const availabilityFollowUpSnapshots = pgTable(
  'availability_follow_up_snapshot',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    capturedOn: date('captured_on').notNull(),
    // null = résidences sans gestionnaire
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id, { onDelete: 'cascade' }),
    recentResidences: integer('recent_residences').notNull().default(0),
    recentResidencesApi: integer('recent_residences_api').notNull().default(0),
    recentApartments: integer('recent_apartments').notNull().default(0),
    recentApartmentsApi: integer('recent_apartments_api').notNull().default(0),
    staleResidences: integer('stale_residences').notNull().default(0),
    staleResidencesApi: integer('stale_residences_api').notNull().default(0),
    staleApartments: integer('stale_apartments').notNull().default(0),
    staleApartmentsApi: integer('stale_apartments_api').notNull().default(0),
    missingResidences: integer('missing_residences').notNull().default(0),
    missingResidencesApi: integer('missing_residences_api').notNull().default(0),
    missingApartments: integer('missing_apartments').notNull().default(0),
    missingApartmentsApi: integer('missing_apartments_api').notNull().default(0),
  },
  (t) => [
    index('availability_follow_up_snapshot_captured_on_idx').on(t.capturedOn),
    // Un relevé par gestionnaire et par date (le cron purge puis réinsère la date du jour).
    uniqueIndex('availability_follow_up_snapshot_owner_date_unique').on(t.capturedOn, t.ownerId),
  ],
)
