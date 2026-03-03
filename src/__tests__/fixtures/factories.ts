import { sql } from 'drizzle-orm'
import { academies } from '../../server/db/schema/academies'
import { accommodations } from '../../server/db/schema/accommodations'
import { cities } from '../../server/db/schema/cities'
import { departments } from '../../server/db/schema/departments'
import { externalSources } from '../../server/db/schema/external-sources'
import { favoriteAccommodations } from '../../server/db/schema/favorite-accommodations'
import { owners } from '../../server/db/schema/owners'
import { getTestDb } from '../helpers/test-db'

type AcademyInsert = typeof academies.$inferInsert
type DepartmentInsert = typeof departments.$inferInsert
type CityInsert = typeof cities.$inferInsert
type AccommodationInsert = typeof accommodations.$inferInsert
type OwnerInsert = typeof owners.$inferInsert
type ExternalSourceInsert = typeof externalSources.$inferInsert
type FavoriteAccommodationInsert = typeof favoriteAccommodations.$inferInsert

export async function createAcademy(overrides: Partial<AcademyInsert> = {}) {
  const db = getTestDb()
  const [row] = await db
    .insert(academies)
    .values({
      name: 'Académie de Lyon',
      ...overrides,
    })
    .returning()
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

export async function createCity(overrides: Omit<Partial<CityInsert>, 'departmentId'> & { departmentId: number }) {
  const db = getTestDb()
  const [row] = await db
    .insert(cities)
    .values({
      name: 'Saint-Étienne',
      slug: 'saint-etienne',
      postalCodes: ['42000'],
      inseeCodes: ['42218'],
      popular: false,
      ...overrides,
    })
    .returning()
  return row
}

export async function createOwner(overrides: Partial<OwnerInsert> = {}) {
  const db = getTestDb()
  const [row] = await db
    .insert(owners)
    .values({
      name: 'Bailleur Test',
      slug: 'bailleur-test',
      ...overrides,
    })
    .returning()
  return row
}

export async function createAccommodation(
  overrides: Partial<AccommodationInsert> & { geom?: { type: string; coordinates: [number, number] } } = {},
) {
  const db = getTestDb()
  const { geom, ...rest } = overrides
  const values = {
    name: 'Résidence Test',
    slug: 'residence-test',
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
