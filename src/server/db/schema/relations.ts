import { relations } from 'drizzle-orm'
import { academies } from './academies'
import { accommodationAddresses } from './accommodation-addresses'
import { accommodationTypologies } from './accommodation-typologies'
import { accommodations } from './accommodations'
import { adminOwnerLinks } from './admin-owner-links'
import { user } from './auth'
import { budgetSimulations } from './budget-simulations'
import { cities } from './cities'
import { contactRequests } from './contacts'
import { departments } from './departments'
import { dossierFacileApplications, dossierFacileDocuments, dossierFacileTenants } from './dossier-facile'
import { externalSources } from './external-sources'
import { favoriteAccommodations } from './favorite-accommodations'
import { housingAidSimulations } from './housing-aid-simulations'
import { owners } from './owners'
import { studentAlerts } from './student-alerts'

export const academiesRelations = relations(academies, ({ many }) => ({
  departments: many(departments),
}))

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  academy: one(academies, { fields: [departments.academyId], references: [academies.id] }),
  cities: many(cities),
}))

export const citiesRelations = relations(cities, ({ one, many }) => ({
  department: one(departments, { fields: [cities.departmentId], references: [departments.id] }),
  accommodations: many(accommodations),
  accommodationAddresses: many(accommodationAddresses),
}))

export const userRelations = relations(user, ({ one, many }) => ({
  owner: one(owners, { fields: [user.ownerId], references: [owners.id] }),
  dossierFacileTenant: one(dossierFacileTenants, { fields: [user.id], references: [dossierFacileTenants.userId] }),
  adminOwnerLinks: many(adminOwnerLinks),
  favoriteAccommodations: many(favoriteAccommodations),
  housingAidSimulation: one(housingAidSimulations, { fields: [user.id], references: [housingAidSimulations.userId] }),
  budgetSimulation: one(budgetSimulations, { fields: [user.id], references: [budgetSimulations.userId] }),
  contactRequests: many(contactRequests),
}))

export const housingAidSimulationsRelations = relations(housingAidSimulations, ({ one }) => ({
  user: one(user, { fields: [housingAidSimulations.userId], references: [user.id] }),
}))

export const budgetSimulationsRelations = relations(budgetSimulations, ({ one }) => ({
  user: one(user, { fields: [budgetSimulations.userId], references: [user.id] }),
}))

export const contactRequestsRelations = relations(contactRequests, ({ one }) => ({
  user: one(user, { fields: [contactRequests.userId], references: [user.id] }),
  accommodation: one(accommodations, { fields: [contactRequests.accommodationId], references: [accommodations.id] }),
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
  adminOwnerLinks: many(adminOwnerLinks),
}))

export const adminOwnerLinksRelations = relations(adminOwnerLinks, ({ one }) => ({
  user: one(user, { fields: [adminOwnerLinks.userId], references: [user.id] }),
  owner: one(owners, { fields: [adminOwnerLinks.ownerId], references: [owners.id] }),
}))

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  owner: one(owners, { fields: [accommodations.ownerId], references: [owners.id] }),
  addresses: many(accommodationAddresses),
  favorites: many(favoriteAccommodations),
  externalSources: many(externalSources),
  applications: many(dossierFacileApplications),
  typologies: many(accommodationTypologies),
}))

export const accommodationTypologiesRelations = relations(accommodationTypologies, ({ one }) => ({
  accommodation: one(accommodations, { fields: [accommodationTypologies.accommodationId], references: [accommodations.id] }),
}))

export const accommodationAddressesRelations = relations(accommodationAddresses, ({ one }) => ({
  accommodation: one(accommodations, { fields: [accommodationAddresses.accommodationId], references: [accommodations.id] }),
  city: one(cities, { fields: [accommodationAddresses.cityId], references: [cities.id] }),
}))

export const favoriteAccommodationsRelations = relations(favoriteAccommodations, ({ one }) => ({
  accommodation: one(accommodations, { fields: [favoriteAccommodations.accommodationId], references: [accommodations.id] }),
  user: one(user, { fields: [favoriteAccommodations.userId], references: [user.id] }),
}))

export const externalSourcesRelations = relations(externalSources, ({ one }) => ({
  accommodation: one(accommodations, { fields: [externalSources.accommodationId], references: [accommodations.id] }),
}))

export const studentAlertsRelations = relations(studentAlerts, ({ one }) => ({
  city: one(cities, { fields: [studentAlerts.cityId], references: [cities.id] }),
  department: one(departments, { fields: [studentAlerts.departmentId], references: [departments.id] }),
  academy: one(academies, { fields: [studentAlerts.academyId], references: [academies.id] }),
}))
