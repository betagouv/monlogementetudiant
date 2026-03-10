import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOwner } from '../../../src/__tests__/fixtures/factories'
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
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/test.jpg'),
  generateAccommodationKey: vi.fn().mockReturnValue('test-key.jpg'),
}))

const { default: command } = await import('../import-arpej-ibail')

beforeEach(() => {
  mockFetch.mockReset()
  process.env.IBAIL_API_HOST = 'https://ibail.example.com'
  process.env.IBAIL_API_AUTH_KEY = 'test-key'
  process.env.IBAIL_API_AUTH_SECRET = 'test-secret'
})

describe('import-arpej-ibail integration', () => {
  it('creates accommodations and external sources from API data', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej', url: 'https://www.arpej.fr/fr/' })

    const residences = [
      {
        key: 'res-001',
        title: 'Résidence Soleil',
        address: '10 Rue du Soleil',
        zip_code: '75001',
        city: 'Paris',
        rent_amount_from: 400,
        rent_amount_to: 600,
        accommodation_quantity: 50,
        available_accommodation_quantity: 5,
        description: 'Belle résidence',
        images: [{ url: 'https://images.example.com/soleil.jpg' }],
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => residences,
      headers: new Headers({
        'X-Pagination-Total-Pages': '1',
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            properties: { city: 'Paris', name: '10 Rue du Soleil', postcode: '75001' },
          },
        ],
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new ArrayBuffer(100),
    })

    const result = await command.execute({ verbose: true })

    expect(result.created).toBe(1)

    const accs = await db.select().from(accommodations)
    const created = accs.find((a) => a.name === 'Résidence Soleil')
    expect(created).toBeDefined()
    expect(created!.postalCode).toBe('75001')

    const sources = await db
      .select()
      .from(externalSources)
      .where(and(eq(externalSources.source, 'arpej'), eq(externalSources.sourceId, 'res-001')))
    expect(sources).toHaveLength(1)
  })

  it('updates existing accommodation on re-import', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-2', url: 'https://www.arpej.fr/fr/' })

    const residences = [
      {
        key: 'res-002',
        title: 'Résidence Lune',
        address: '20 Rue de la Lune',
        zip_code: '75002',
        city: 'Paris',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => residences,
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.35, 48.86] },
            properties: { city: 'Paris', name: '20 Rue de la Lune', postcode: '75002' },
          },
        ],
      }),
    })

    await command.execute({})

    const updated = [
      {
        key: 'res-002',
        title: 'Résidence Lune Renovée',
        address: '20 Rue de la Lune',
        zip_code: '75002',
        city: 'Paris',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.35, 48.86] },
            properties: { city: 'Paris', name: '20 Rue de la Lune', postcode: '75002' },
          },
        ],
      }),
    })

    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, 'res-002'))
    expect(sources).toHaveLength(1)

    const acc = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    expect(acc[0].name).toBe('Résidence Lune Renovée')
  })
})
