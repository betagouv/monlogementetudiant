import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { createAcademy, createCity, createDepartment } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { cities } from '../../../src/server/db/schema'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const testDb = getTestDb()

vi.mock('../../lib/db', () => ({
  db: testDb,
  closeDb: vi.fn(),
}))

const { default: command } = await import('../sync-students')

describe('sync-students integration', () => {
  it('updates nb_students for cities matched by INSEE code', async () => {
    const db = getTestDb()

    const academy = await createAcademy({ name: 'Académie Test' })
    const dept = await createDepartment({ academyId: academy.id, name: 'Paris', code: '75' })
    const paris = await createCity({
      departmentId: dept.id,
      name: 'Paris',
      slug: 'paris',
      postalCodes: ['75001'],
      inseeCodes: ['75056'],
    })

    const records = [
      { annee_universitaire: '2023-24', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 100 },
      { annee_universitaire: '2023-24', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 200 },
      { annee_universitaire: '2022-23', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 50 },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => records,
    })

    const result = await command.execute({})

    expect(result.updated).toBeGreaterThanOrEqual(1)

    // Paris should have 300 students (100 + 200, not 50 from 2022-23)
    const updatedParis = await db.select().from(cities).where(eq(cities.id, paris.id))
    expect(updatedParis[0].nbStudents).toBe(300)
  })

  it('matches by name + department as fallback', async () => {
    const db = getTestDb()

    const academy = await createAcademy({ name: 'Académie Test 2' })
    const dept = await createDepartment({ academyId: academy.id, name: 'Loire', code: '42' })
    const city = await createCity({
      departmentId: dept.id,
      name: 'Saint-Étienne',
      slug: 'saint-etienne',
      postalCodes: ['42000'],
      inseeCodes: ['99999'], // Wrong INSEE to force fallback
    })

    const records = [{ annee_universitaire: '2023-24', com_code: '42218', com_nom: 'saint-étienne', dp_code: '42', effectif: 500 }]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => records,
    })

    const _result = await command.execute({})

    const updatedCity = await db.select().from(cities).where(eq(cities.id, city.id))
    expect(updatedCity[0].nbStudents).toBe(500)
  })
})
