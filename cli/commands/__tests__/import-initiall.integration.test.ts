import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodations, externalSources } from '../../../src/server/db/schema'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const testDb = getTestDb()

vi.mock('../../lib/db', () => ({
  db: testDb,
  closeDb: vi.fn(),
}))

vi.mock('../../../src/server/services/s3', () => ({
  uploadFile: vi.fn(async ({ key }: { key: string }) => `https://s3.gra.io.cloud.ovh.net/bucket/${key}`),
  generateAccommodationKey: vi.fn((ext: string) => `accommodations/mock-uuid.${ext}`),
}))

vi.mock('../../lib/geocoder', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/geocoder')>()
  return {
    ...original,
    ensureCity: vi.fn(async (_postalCode: string, cityName: string) => ({ name: cityName, id: 0 })),
  }
})

const { default: command } = await import('../import-initiall')

function makeResidence(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    title: { rendered: 'Résidence Initiall Test' },
    link: 'https://initiall.immo/residence/test',
    acf: {
      address: {
        address: '10 Rue du Test',
        city: 'Paris',
        post_code: '75001',
        lat: 48.8566,
        lng: 2.3522,
      },
      price: '400',
      residence_full: false,
      residence_for_students_only: true,
    },
    _embedded: {},
    ...overrides,
  }
}

function mockApiPages(residences: unknown[]) {
  // Page 1 with residences
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => residences,
    headers: new Headers({ 'x-wp-totalpages': '1' }),
  })
}

function mockGeocoder() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      features: [
        {
          geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
          properties: { city: 'Paris', name: '10 Rue du Test', postcode: '75001' },
        },
      ],
    }),
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('import-initiall integration', () => {
  it('creates accommodation from API data', async () => {
    const db = getTestDb()

    mockApiPages([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ verbose: true })

    expect(result.created).toBe(1)

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, '1001'))
    expect(sources).toHaveLength(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    expect(created).toBeDefined()
    expect(created!.name).toBe('Résidence Initiall Test')
  })

  it('slug must not change on re-import with same name', async () => {
    const db = getTestDb()

    const residence = makeResidence({ id: 2001, title: { rendered: 'Résidence Stabilité Initiall' } })

    // First import: create
    mockApiPages([residence])
    mockGeocoder()

    await command.execute({})

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, '2001'))
    expect(sources).toHaveLength(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    const originalSlug = created!.slug

    // Second import: update (same id, same name)
    mockApiPages([residence])
    mockGeocoder()

    const result = await command.execute({})
    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, created!.id))
    expect(updated!.slug).toBe(originalSlug)
  })
})
