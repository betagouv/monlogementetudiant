import { bigint, geometry, pgTable, varchar } from 'drizzle-orm/pg-core'

export const academies = pgTable('territories_academy', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  boundary: geometry({ type: 'multipolygon', srid: 4326 }),
})
