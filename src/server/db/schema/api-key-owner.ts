import { bigint, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { apikey } from './api-key'
import { owners } from './owners'

/**
 * Rattache une clé d'API à un bailleur. Absence de ligne = clé « catalogue » sans accès aux contacts.
 * Table séparée pour ne pas toucher à `apikey` (gérée par le plugin better-auth).
 */
export const apiKeyOwners = pgTable(
  'api_key_owner',
  {
    apiKeyId: text('api_key_id')
      .primaryKey()
      .references(() => apikey.id, { onDelete: 'cascade' }),
    ownerId: bigint('owner_id', { mode: 'number' })
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('api_key_owner_owner_id_idx').on(t.ownerId)],
)
