import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { createAcademy, createAccommodation, createCity, createDepartment } from '~/__tests__/fixtures/factories'
import { getTestDb } from '~/__tests__/helpers/test-db'
import { accommodationAddresses, cities } from '~/server/db/schema'

const mockFetch = vi.fn().mockImplementation((url: string) => {
  // fetchCommunesByDepartment calls → return empty array so step 4 is a no-op
  if (typeof url === 'string' && url.includes('/departements/')) {
    return Promise.resolve({ ok: true, status: 200, json: async () => [] })
  }
  // Default: handled by per-test mockResolvedValue
  return Promise.resolve({ ok: true, status: 200, json: async () => [] })
})
vi.stubGlobal('fetch', mockFetch)

const { default: command } = await import('../sync-cities')

describe('sync-cities integration', () => {
  it('creates Paris, Marseille, and Lyon when departments exist', async () => {
    const academy = await createAcademy({ name: 'Académie Test' })
    await createDepartment({ academyId: academy.id, name: 'Paris', code: '75' })
    await createDepartment({ academyId: academy.id, name: 'Bouches-du-Rhône', code: '13' })
    await createDepartment({ academyId: academy.id, name: 'Rhône', code: '69' })

    // Mock geo API calls for fillCityFromApi (postalCode lookup for each city)
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/departements/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [
          {
            nom: 'Paris',
            code: '75056',
            codesPostaux: ['75001'],
            codeDepartement: '75',
            codeEpci: '200054781',
            population: 2100000,
          },
        ],
      })
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

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/departements/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [
          {
            nom: 'Marseille',
            code: '13055',
            codesPostaux: ['13001'],
            codeDepartement: '13',
            codeEpci: '200054807',
            population: 870000,
          },
        ],
      })
    })

    const result = await command.execute({ dryRun: true, verbose: true })

    // Paris skipped, Marseille + Lyon created (dry-run) + Paris updated (dry-run step 2)
    expect(result.skipped).toBeGreaterThanOrEqual(1)
    expect(result.updated).toBeGreaterThanOrEqual(2)
  })

  it('aligns a city on its INSEE code and frees its slug for the homonym', async () => {
    const db = getTestDb()
    const academy = await createAcademy({ name: 'Académie Versailles' })
    const dept = await createDepartment({ academyId: academy.id, name: "Val-d'Oise", code: '95' })
    for (const code of ['75', '13', '69']) await createDepartment({ academyId: academy.id, name: `Dept ${code}`, code })

    const mislabeled = await createCity({
      departmentId: dept.id,
      name: 'Boisemont',
      slug: 'boisemont',
      postalCodes: ['95000'],
      inseeCodes: ['95127'],
    })
    const homonym = await createCity({
      departmentId: dept.id,
      name: 'Boisemont',
      slug: 'boisemont-1',
      postalCodes: ['95000'],
      inseeCodes: ['95074'],
    })

    const communes: Record<string, object> = {
      '95127': { nom: 'Cergy', code: '95127', codesPostaux: ['95000', '95800'], codeDepartement: '95', population: 70906 },
      '95074': { nom: 'Boisemont', code: '95074', codesPostaux: ['95000'], codeDepartement: '95', population: 892 },
    }
    mockFetch.mockImplementation((url: string) => {
      const insee = /\/communes\/(\d+)\?/.exec(url)?.[1]
      if (insee && communes[insee]) return Promise.resolve({ ok: true, status: 200, json: async () => communes[insee] })
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    await command.execute({ dryRun: false })

    const [cergy] = await db.select().from(cities).where(eq(cities.id, mislabeled.id))
    const [boisemont] = await db.select().from(cities).where(eq(cities.id, homonym.id))
    expect(cergy).toMatchObject({ name: 'Cergy', slug: 'cergy', postalCodes: ['95000', '95800'] })
    expect(boisemont).toMatchObject({ name: 'Boisemont', slug: 'boisemont' })
  })

  it('reattaches an address to the city whose boundary contains it', async () => {
    const db = getTestDb()
    const academy = await createAcademy({ name: 'Académie Nantes' })
    const dept = await createDepartment({ academyId: academy.id, name: 'Loire', code: '42' })
    for (const code of ['75', '13', '69']) await createDepartment({ academyId: academy.id, name: `Dept ${code}`, code })

    const square = (x: number, y: number) => ({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [x, y],
            [x + 0.1, y],
            [x + 0.1, y + 0.1],
            [x, y + 0.1],
            [x, y],
          ],
        ],
      ],
    })
    const wrong = await createCity({ departmentId: dept.id, name: 'Loin', slug: 'loin', boundary: square(4, 45) })
    const right = await createCity({ departmentId: dept.id, name: 'Ici', slug: 'ici', boundary: square(-1.6, 47.2) })
    const accommodation = await createAccommodation({ cityId: wrong.id, geom: { type: 'Point', coordinates: [-1.55, 47.25] } })

    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 404, json: async () => null }))

    await command.execute({ dryRun: false })

    const [address] = await db
      .select({ cityId: accommodationAddresses.cityId })
      .from(accommodationAddresses)
      .where(eq(accommodationAddresses.accommodationId, accommodation.id))
    expect(address.cityId).toBe(right.id)
  })
})
