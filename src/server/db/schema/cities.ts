import { bigint, boolean, doublePrecision, geometry, integer, pgTable, varchar } from 'drizzle-orm/pg-core'
import { departments } from './departments'

export const cities = pgTable('territories_city', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  postalCodes: varchar('postal_codes', { length: 5 }).array().notNull(),
  inseeCodes: varchar('insee_codes', { length: 5 }).array().notNull(),
  epciCode: varchar('epci_code', { length: 9 }),
  boundary: geometry({ type: 'multipolygon', srid: 4326 }),
  departmentId: bigint('department_id', { mode: 'number' })
    .notNull()
    .references(() => departments.id),
  popular: boolean().notNull(),
  population: integer(),
  averageIncome: doublePrecision('average_income'),
  nbStudents: integer('nb_students'),
  averageRent: doublePrecision('average_rent'),
})
