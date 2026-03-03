import { bigint, geometry, pgTable, varchar } from 'drizzle-orm/pg-core'
import { academies } from './academies'

export const departments = pgTable('territories_department', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  code: varchar({ length: 3 }).notNull(),
  boundary: geometry({ type: 'multipolygon', srid: 4326 }),
  academyId: bigint('academy_id', { mode: 'number' })
    .notNull()
    .references(() => academies.id),
})
