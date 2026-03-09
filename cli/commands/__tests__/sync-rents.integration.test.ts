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

const { default: command } = await import('../sync-rents')

describe('sync-rents integration', () => {
  it('updates cities with matching EPCI codes', async () => {
    const db = getTestDb()

    const academy = await createAcademy({ name: 'Académie Test' })
    const dept = await createDepartment({ academyId: academy.id, name: 'Dept Test', code: '42' })
    const city1 = await createCity({
      departmentId: dept.id,
      name: 'Ville A',
      slug: 'ville-a',
      epciCode: '200054781',
      postalCodes: ['42000'],
      inseeCodes: ['42001'],
    })
    const city2 = await createCity({
      departmentId: dept.id,
      name: 'Ville B',
      slug: 'ville-b',
      epciCode: '200066008',
      postalCodes: ['42100'],
      inseeCodes: ['42002'],
    })
    const _cityNoEpci = await createCity({
      departmentId: dept.id,
      name: 'Ville C',
      slug: 'ville-c',
      postalCodes: ['42200'],
      inseeCodes: ['42003'],
    })

    const csvContent = '"EPCI";"loypredm2"\n"200054781";"12,50"\n"200066008";"8,30"\n'
    const buffer = Buffer.from(csvContent, 'latin1')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    })

    const result = await command.execute({})

    expect(result.updated).toBe(2)
    expect(result.skipped).toBeGreaterThanOrEqual(1)

    // Verify average_rent was updated
    const updatedCity1 = await db.select().from(cities).where(eq(cities.id, city1.id))
    expect(updatedCity1[0].averageRent).toBe(12.5)

    const updatedCity2 = await db.select().from(cities).where(eq(cities.id, city2.id))
    expect(updatedCity2[0].averageRent).toBe(8.3)
  })
})
