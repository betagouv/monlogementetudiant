import { describe, it, expect, vi } from 'vitest'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { cities } from '../../../src/server/db/schema'
import { createAcademy, createDepartment } from '../../../src/__tests__/fixtures/factories'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const testDb = getTestDb()

vi.mock('../../lib/db', () => ({
  db: testDb,
  closeDb: vi.fn(),
}))

const { default: command } = await import('../sync-cities')

describe('sync-cities integration', () => {
  it('creates Paris, Marseille, and Lyon when departments exist', async () => {
    const academy = await createAcademy({ name: 'Académie Test' })
    await createDepartment({ academyId: academy.id, name: 'Paris', code: '75' })
    await createDepartment({ academyId: academy.id, name: 'Bouches-du-Rhône', code: '13' })
    await createDepartment({ academyId: academy.id, name: 'Rhône', code: '69' })

    // Mock geo API calls for fillCityFromApi (postalCode lookup for each city)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{
        nom: 'Paris',
        code: '75056',
        codesPostaux: ['75001'],
        codeDepartement: '75',
        codeEpci: '200054781',
        population: 2100000,
      }],
    })

    const result = await command.execute({ dryRun: true, verbose: true })

    // 3 special cities created (dry-run) + update existing pass (0 existing) + missing cities pass (0 missing)
    expect(result.updated).toBe(3)
  })

  it('skips existing special cities', async () => {
    const db = getTestDb()

    const academy = await createAcademy({ name: 'Académie Test 2' })
    const dept = await createDepartment({ academyId: academy.id, name: 'Paris', code: '75' })

    // Pre-create Paris
    await db.insert(cities).values({
      name: 'Paris',
      slug: 'paris',
      postalCodes: ['75001'],
      inseeCodes: ['75056'],
      departmentId: dept.id,
      popular: true,
    })

    // Need dept 13 and 69 for Marseille/Lyon
    await createDepartment({ academyId: academy.id, name: 'Bouches-du-Rhône', code: '13' })
    await createDepartment({ academyId: academy.id, name: 'Rhône', code: '69' })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{
        nom: 'Marseille',
        code: '13055',
        codesPostaux: ['13001'],
        codeDepartement: '13',
        codeEpci: '200054807',
        population: 870000,
      }],
    })

    const result = await command.execute({ dryRun: true, verbose: true })

    // Paris skipped, Marseille + Lyon created (dry-run) + Paris updated (dry-run step 2)
    expect(result.skipped).toBeGreaterThanOrEqual(1)
    expect(result.updated).toBeGreaterThanOrEqual(2)
  })
})
