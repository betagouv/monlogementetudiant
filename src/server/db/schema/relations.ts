import { relations } from 'drizzle-orm'
import { academies } from './academies'
import { accommodations } from './accommodations'
import { user } from './auth'
import { cities } from './cities'
import { departments } from './departments'
import { dossierFacileApplications, dossierFacileDocuments, dossierFacileTenants } from './dossier-facile'
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

export const userRelations = relations(user, ({ one }) => ({
  owner: one(owners, { fields: [user.ownerId], references: [owners.id] }),
  dossierFacileTenant: one(dossierFacileTenants, { fields: [user.id], references: [dossierFacileTenants.userId] }),
}))

export const dossierFacileTenantsRelations = relations(dossierFacileTenants, ({ one, many }) => ({
  user: one(user, { fields: [dossierFacileTenants.userId], references: [user.id] }),
  applications: many(dossierFacileApplications),
  documents: many(dossierFacileDocuments),
}))

export const dossierFacileDocumentsRelations = relations(dossierFacileDocuments, ({ one }) => ({
  tenant: one(dossierFacileTenants, { fields: [dossierFacileDocuments.tenantId], references: [dossierFacileTenants.id] }),
}))

export const dossierFacileApplicationsRelations = relations(dossierFacileApplications, ({ one }) => ({
  tenant: one(dossierFacileTenants, { fields: [dossierFacileApplications.tenantId], references: [dossierFacileTenants.id] }),
  accommodation: one(accommodations, { fields: [dossierFacileApplications.accommodationSlug], references: [accommodations.slug] }),
}))

export const ownersRelations = relations(owners, ({ many }) => ({
  accommodations: many(accommodations),
  users: many(user),
}))

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  owner: one(owners, { fields: [accommodations.ownerId], references: [owners.id] }),
  favorites: many(favoriteAccommodations),
  externalSources: many(externalSources),
  applications: many(dossierFacileApplications),
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
