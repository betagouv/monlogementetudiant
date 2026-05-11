import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createExternalSource, createImportBlocklist, createOwner } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodationAddresses, accommodations, externalSources } from '../../../src/server/db/schema'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../../src/server/services/s3', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/test.jpg'),
  generateAccommodationKey: vi.fn().mockReturnValue('test-key.jpg'),
}))

const { default: command } = await import('../import-arpej-ibail')

beforeEach(() => {
  mockFetch.mockReset()
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
      json: async () => ({ residences }),
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

    const [created] = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Soleil'))
    expect(created).toBeDefined()

    const [addr] = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, created!.id))
    expect(addr.postalCode).toBe('75001')

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
      json: async () => ({ residences }),
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
      json: async () => ({ residences: updated }),
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

  it('slug must not change on re-import with same name', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-slug', url: 'https://www.arpej.fr/fr/' })

    const residence = {
      key: 'res-slug-001',
      title: 'Résidence Stabilité',
      address: '10 Rue Stable',
      zip_code: '75001',
      city: 'Paris',
      rent_amount_from: 400,
      accommodation_quantity: 10,
    }

    // First import: create
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ residences: [residence] }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.35, 48.86] },
            properties: { city: 'Paris', name: '10 Rue Stable', postcode: '75001' },
          },
        ],
      }),
    })

    await command.execute({})

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, 'res-slug-001'))
    const [created] = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    const originalSlug = created!.slug

    // Second import: update (same key, same name)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ residences: [residence] }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.35, 48.86] },
            properties: { city: 'Paris', name: '10 Rue Stable', postcode: '75001' },
          },
        ],
      }),
    })

    const result = await command.execute({})
    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, created!.id))
    expect(updated!.slug).toBe(originalSlug)
  })

  it('skips blocked residences before creation', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-block-create', url: 'https://www.arpej.fr/fr/' })
    await createImportBlocklist({ source: 'arpej', sourceId: 'res-blocked-create', reason: 'Suppression définitive' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'res-blocked-create',
            title: 'Résidence Bloquée Création',
            address: '10 Rue Interdite',
            zip_code: '75010',
            city: 'Paris',
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })

    const result = await command.execute({})

    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)

    const blocked = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Bloquée Création'))
    expect(blocked).toHaveLength(0)
  })

  it('skips blocked residences before update', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-block-update', url: 'https://www.arpej.fr/fr/' })
    const existing = await createAccommodation({
      name: 'Résidence Préservée',
      slug: 'residence-preservee',
      postalCode: '75011',
    })
    await createExternalSource({ accommodationId: existing.id, source: 'arpej', sourceId: 'res-blocked-update' })
    await createImportBlocklist({ source: 'arpej', sourceId: 'res-blocked-update', reason: 'Suppression définitive' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'res-blocked-update',
            title: 'Résidence Modifiée',
            address: '11 Rue Interdite',
            zip_code: '75011',
            city: 'Paris',
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })

    const result = await command.execute({})

    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)

    const [unchanged] = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    expect(unchanged.name).toBe('Résidence Préservée')
  })
})
