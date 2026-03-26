import { eq, sql } from 'drizzle-orm'
import { academies } from '../../server/db/schema/academies'
import { accommodations } from '../../server/db/schema/accommodations'
import { user } from '../../server/db/schema/auth'
import { cities } from '../../server/db/schema/cities'
import { departments } from '../../server/db/schema/departments'
import { dossierFacileApplications, dossierFacileTenants } from '../../server/db/schema/dossier-facile'
import { externalSources } from '../../server/db/schema/external-sources'
import { favoriteAccommodations } from '../../server/db/schema/favorite-accommodations'
import { owners } from '../../server/db/schema/owners'
import { studentAlerts } from '../../server/db/schema/student-alerts'
import { getTestDb } from '../helpers/test-db'

type UserInsert = typeof user.$inferInsert
type AcademyInsert = typeof academies.$inferInsert
type DepartmentInsert = typeof departments.$inferInsert
type CityInsert = typeof cities.$inferInsert
type AccommodationInsert = typeof accommodations.$inferInsert
type OwnerInsert = typeof owners.$inferInsert
type ExternalSourceInsert = typeof externalSources.$inferInsert
type FavoriteAccommodationInsert = typeof favoriteAccommodations.$inferInsert
type StudentAlertInsert = typeof studentAlerts.$inferInsert
type DossierFacileTenantInsert = typeof dossierFacileTenants.$inferInsert
type DossierFacileApplicationInsert = typeof dossierFacileApplications.$inferInsert

export async function createUser(overrides: Partial<UserInsert> & { id: string }) {
  const db = getTestDb()
  const [row] = await db
    .insert(user)
    .values({
      email: `${overrides.id}@test.com`,
      name: 'Test User',
      emailVerified: true,
      role: 'user',
      ...overrides,
    })
    .onConflictDoNothing()
    .returning()
  return row
}

export async function createAcademy(
  overrides: Partial<Omit<AcademyInsert, 'boundary'>> & { boundary?: { type: string; coordinates: number[][][][] } } = {},
) {
  const db = getTestDb()
  const { boundary, ...rest } = overrides
  const values = {
    name: 'Académie de Lyon',
    ...rest,
    ...(boundary ? { boundary: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326)` } : {}),
  }
  const [row] = await db
    .insert(academies)
    .values(values as typeof academies.$inferInsert)
    .returning({ id: academies.id, name: academies.name })
  return row
}

export async function createDepartment(overrides: Omit<Partial<DepartmentInsert>, 'academyId'> & { academyId: number }) {
  const db = getTestDb()
  const [row] = await db
    .insert(departments)
    .values({
      name: 'Loire',
      code: '42',
      ...overrides,
    })
    .returning()
  return row
}

export async function createCity(
  overrides: Omit<Partial<CityInsert>, 'departmentId' | 'boundary'> & {
    departmentId: number
    boundary?: { type: string; coordinates: number[][][][] }
  },
) {
  const db = getTestDb()
  const { boundary, ...rest } = overrides
  const suffix = ++cityCounter
  const [row] = await db
    .insert(cities)
    .values({
      name: 'Saint-Étienne',
      slug: 'saint-etienne',
      postalCodes: ['42000'],
      inseeCodes: [String(42000 + suffix).padStart(5, '0')],
      popular: false,
      ...rest,
      ...(boundary ? { boundary: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326)` } : {}),
    })
    .returning({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
      departmentId: cities.departmentId,
      popular: cities.popular,
    })
  return row
}

export async function createOwner(overrides: Partial<OwnerInsert> & { userId?: string } = {}) {
  const db = getTestDb()
  const { userId, ...ownerFields } = overrides
  const [row] = await db
    .insert(owners)
    .values({
      name: 'Bailleur Test',
      slug: 'bailleur-test',
      ...ownerFields,
    })
    .returning()

  // Link user to owner if userId provided
  if (userId && row) {
    await db.update(user).set({ ownerId: row.id }).where(eq(user.id, userId))
  }

  return row
}

let cityCounter = 0
let accommodationCounter = 0

export async function createAccommodation(
  overrides: Partial<Omit<AccommodationInsert, 'geom'>> & { geom?: { type: string; coordinates: [number, number] | number[][][][] } } = {},
) {
  const db = getTestDb()
  const { geom, ...rest } = overrides
  const suffix = ++accommodationCounter
  const values = {
    name: 'Résidence Test',
    slug: `residence-test-${suffix}`,
    city: 'Saint-Étienne',
    postalCode: '42000',
    published: true,
    available: true,
    imagesCount: 0,
    ...rest,
    ...(geom ? { geom: sql`ST_SetSRID(ST_MakePoint(${geom.coordinates[0]}, ${geom.coordinates[1]}), 4326)` } : {}),
  }
  const [row] = await db
    .insert(accommodations)
    .values(values as typeof accommodations.$inferInsert)
    .returning()
  return row
}

export async function createExternalSource(
  overrides: Omit<Partial<ExternalSourceInsert>, 'accommodationId'> & { accommodationId: number },
) {
  const db = getTestDb()
  const [row] = await db
    .insert(externalSources)
    .values({
      source: 'clef',
      ...overrides,
    })
    .returning()
  return row
}

export async function createFavoriteAccommodation(
  overrides: Omit<Partial<FavoriteAccommodationInsert>, 'userId' | 'accommodationId'> & {
    userId: string
    accommodationId: number
  },
) {
  const db = getTestDb()
  const [row] = await db.insert(favoriteAccommodations).values(overrides).returning()
  return row
}

export async function createAlert(
  overrides: Omit<Partial<StudentAlertInsert>, 'userId' | 'maxPrice'> & {
    userId: string
    maxPrice: number
  },
) {
  const db = getTestDb()
  await createUser({ id: overrides.userId })
  const [row] = await db
    .insert(studentAlerts)
    .values({
      name: 'Alerte Test',
      ...overrides,
    })
    .returning()
  return row
}

export async function createDossierFacileTenant(overrides: Omit<Partial<DossierFacileTenantInsert>, 'userId'> & { userId: string }) {
  const db = getTestDb()
  const [row] = await db
    .insert(dossierFacileTenants)
    .values({
      tenantId: `df-tenant-${crypto.randomUUID().slice(0, 8)}`,
      status: 'verified',
      ...overrides,
    })
    .returning()
  return row
}

export async function createDossierFacileApplication(
  overrides: Omit<Partial<DossierFacileApplicationInsert>, 'tenantId' | 'accommodationSlug' | 'apartmentType'> & {
    tenantId: string
    accommodationSlug: string
    apartmentType: string
  },
) {
  const db = getTestDb()
  const [row] = await db.insert(dossierFacileApplications).values(overrides).returning()
  return row
}
