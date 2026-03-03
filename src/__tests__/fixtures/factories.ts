import { getTestDb } from '../helpers/test-db'
import { academies } from '../../server/db/schema/academies'
import { accommodations } from '../../server/db/schema/accommodations'
import { cities } from '../../server/db/schema/cities'
import { departments } from '../../server/db/schema/departments'

type AcademyInsert = typeof academies.$inferInsert
type DepartmentInsert = typeof departments.$inferInsert
type CityInsert = typeof cities.$inferInsert
type AccommodationInsert = typeof accommodations.$inferInsert

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

export async function createAccommodation(overrides: Partial<AccommodationInsert> = {}) {
  const db = getTestDb()
  const [row] = await db
    .insert(accommodations)
    .values({
      name: 'Résidence Test',
      slug: 'residence-test',
      city: 'Saint-Étienne',
      postalCode: '42000',
      published: true,
      available: true,
      imagesCount: 0,
      ...overrides,
    })
    .returning()
  return row
}
