import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/db'
import {
  academies,
  accommodations,
  budgetSimulations,
  cities,
  contactRequests,
  departments,
  dossierFacileApplications,
  dossierFacileDocuments,
  dossierFacileTenants,
  favoriteAccommodations,
  housingAidSimulations,
  studentAlerts,
  studentGoalLists,
  studentGoals,
  supportTickets,
  user,
} from '~/server/db/schema'

export async function collectStudentData(userId: string) {
  const profile = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      email: true,
      firstname: true,
      lastname: true,
      phone: true,
      birthdate: true,
      scholarshipStatus: true,
      scholarshipType: true,
      isWorkStudy: true,
      studyInstitution: true,
      studyYear: true,
      similarAccommodationAlertsEnabled: true,
      favoriteAlertsEnabled: true,
      createdAt: true,
      lastActiveAt: true,
    },
  })
  if (!profile) return null

  const [candidatures, favoris, alertes, simulationsBudget, simulationsAides, listesObjectifs, ticketsSupport, dossierFacile] =
    await Promise.all([
      db
        .select({
          residence: accommodations.name,
          typeDeLogement: contactRequests.apartmentType,
          statut: contactRequests.status,
          deposeLe: contactRequests.createdAt,
          confirmeeLe: contactRequests.confirmedAt,
          anonymiseeLe: contactRequests.anonymizedAt,
        })
        .from(contactRequests)
        .innerJoin(accommodations, eq(contactRequests.accommodationId, accommodations.id))
        .where(eq(contactRequests.userId, userId)),
      db
        .select({ residence: accommodations.name, ajouteLe: favoriteAccommodations.createdAt })
        .from(favoriteAccommodations)
        .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
        .where(eq(favoriteAccommodations.userId, userId)),
      db
        .select({
          nom: studentAlerts.name,
          budgetMax: studentAlerts.maxPrice,
          ville: cities.name,
          departement: departments.name,
          academie: academies.name,
          notifications: studentAlerts.receiveNotifications,
          creeLe: studentAlerts.createdAt,
          expireeLe: studentAlerts.expiredAt,
        })
        .from(studentAlerts)
        .leftJoin(cities, eq(studentAlerts.cityId, cities.id))
        .leftJoin(departments, eq(studentAlerts.departmentId, departments.id))
        .leftJoin(academies, eq(studentAlerts.academyId, academies.id))
        .where(eq(studentAlerts.userId, userId)),
      db
        .select({ donnees: budgetSimulations.inputs, misAJourLe: budgetSimulations.updatedAt })
        .from(budgetSimulations)
        .where(eq(budgetSimulations.userId, userId)),
      db
        .select({ donnees: housingAidSimulations.inputs, misAJourLe: housingAidSimulations.updatedAt })
        .from(housingAidSimulations)
        .where(eq(housingAidSimulations.userId, userId)),
      collectGoalLists(userId),
      db
        .select({
          categorie: supportTickets.category,
          message: supportTickets.message,
          statut: supportTickets.status,
          creeLe: supportTickets.createdAt,
        })
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId)),
      collectDossierFacile(userId),
    ])

  return {
    exporteLe: new Date(),
    profil: profile,
    candidatures,
    dossierFacile,
    alertes,
    favoris,
    simulationsBudget,
    simulationsAidesAuLogement: simulationsAides,
    listesObjectifs,
    ticketsSupport,
  }
}

async function collectGoalLists(userId: string) {
  const lists = await db
    .select({ id: studentGoalLists.id, rappelsEmail: studentGoalLists.emailRemindersEnabled, creeLe: studentGoalLists.createdAt })
    .from(studentGoalLists)
    .where(eq(studentGoalLists.userId, userId))
  if (lists.length === 0) return []

  const goals = await db
    .select({
      listId: studentGoals.listId,
      titre: studentGoals.title,
      echeance: studentGoals.dueAt,
      termineLe: studentGoals.completedAt,
    })
    .from(studentGoals)
    .where(
      inArray(
        studentGoals.listId,
        lists.map((l) => l.id),
      ),
    )

  return lists.map(({ id, ...list }) => ({
    ...list,
    objectifs: goals.filter((g) => g.listId === id).map(({ listId: _listId, ...goal }) => goal),
  }))
}

async function collectDossierFacile(userId: string) {
  const tenant = await db.query.dossierFacileTenants.findFirst({ where: eq(dossierFacileTenants.userId, userId) })
  if (!tenant) return null

  const [documents, applications] = await Promise.all([
    db
      .select({
        categorie: dossierFacileDocuments.documentCategory,
        sousCategorie: dossierFacileDocuments.documentSubCategory,
        statut: dossierFacileDocuments.documentStatus,
      })
      .from(dossierFacileDocuments)
      .where(eq(dossierFacileDocuments.tenantId, tenant.id)),
    db
      .select({
        residence: dossierFacileApplications.accommodationSlug,
        typeDeLogement: dossierFacileApplications.apartmentType,
        statut: dossierFacileApplications.status,
        deposeeLe: dossierFacileApplications.createdAt,
      })
      .from(dossierFacileApplications)
      .where(eq(dossierFacileApplications.tenantId, tenant.id)),
  ])

  return {
    nom: tenant.name,
    statut: tenant.status,
    dossierUrl: tenant.url,
    dossierPdfUrl: tenant.pdfUrl,
    nombreDeGarants: tenant.guarantorCount,
    lieLe: tenant.createdAt,
    documents,
    candidatures: applications,
  }
}
