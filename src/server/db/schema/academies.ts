import { bigint, geometry, pgTable, varchar } from 'drizzle-orm/pg-core'

export const academies = pgTable('territories_academy', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull().unique(),
  boundary: geometry({ type: 'multipolygon', srid: 4326 }),
})
