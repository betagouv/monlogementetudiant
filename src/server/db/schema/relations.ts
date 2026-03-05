import { relations } from 'drizzle-orm'
import { academies } from './academies'
import { accommodations } from './accommodations'
import { cities } from './cities'
import { departments } from './departments'
import { externalSources } from './external-sources'
import { favoriteAccommodations } from './favorite-accommodations'
import { owners } from './owners'
import { studentAlerts } from './student-alerts'

export const academiesRelations = relations(academies, ({ many }) => ({
  departments: many(departments),
}))

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  academy: one(academies, { fields: [departments.academyId], references: [academies.id] }),
  cities: many(cities),
}))

export const citiesRelations = relations(cities, ({ one }) => ({
  department: one(departments, { fields: [cities.departmentId], references: [departments.id] }),
}))

export const ownersRelations = relations(owners, ({ many }) => ({
  accommodations: many(accommodations),
}))

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  owner: one(owners, { fields: [accommodations.ownerId], references: [owners.id] }),
  favorites: many(favoriteAccommodations),
  externalSources: many(externalSources),
}))

export const favoriteAccommodationsRelations = relations(favoriteAccommodations, ({ one }) => ({
  accommodation: one(accommodations, { fields: [favoriteAccommodations.accommodationId], references: [accommodations.id] }),
}))

export const externalSourcesRelations = relations(externalSources, ({ one }) => ({
  accommodation: one(accommodations, { fields: [externalSources.accommodationId], references: [accommodations.id] }),
}))

export const studentAlertsRelations = relations(studentAlerts, ({ one }) => ({
  city: one(cities, { fields: [studentAlerts.cityId], references: [cities.id] }),
  department: one(departments, { fields: [studentAlerts.departmentId], references: [departments.id] }),
  academy: one(academies, { fields: [studentAlerts.academyId], references: [academies.id] }),
}))
