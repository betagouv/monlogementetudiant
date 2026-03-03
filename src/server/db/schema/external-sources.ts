import { bigint, pgTable, unique, varchar } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'

export const externalSources = pgTable(
  'accommodation_externalsource',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id),
    source: varchar({ length: 100 }).notNull().default('clef'),
    sourceId: varchar('source_id', { length: 100 }),
  },
  (t) => [unique().on(t.source, t.accommodationId)],
)
