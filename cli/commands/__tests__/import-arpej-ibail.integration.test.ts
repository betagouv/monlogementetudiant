import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createExternalSource,
  createImportBlocklist,
  createOwner,
} from '../../../src/__tests__/fixtures/factories'
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
      json: async () => [],
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

  it('creates accommodations from current API availability and pictures fields', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-current-api', url: 'https://www.arpej.fr/fr/' })
    const academy = await createAcademy({ name: 'Académie Versailles' })
    const department = await createDepartment({ academyId: academy.id, code: '91', name: 'Essonne' })
    await createCity({ departmentId: department.id, name: 'Palaiseau', slug: 'palaiseau', postalCodes: ['91120'] })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'SA',
            title: 'Résidence Alexandre Manceau',
            url: 'https://www.arpej.fr/fr/residence/alexandre-manceau-residence-etudiante-palaiseau/',
            address: '26 , Cours Pierre Vasseur',
            address_complement: null,
            zip_code: '91120',
            city: 'Palaiseau',
            description: 'Résidence récente',
            availability: {
              surface_from: 18.21,
              surface_to: 47.6,
              rent_amount_from: 380.8,
              accommodation_quantity: 259,
              count: 1,
              url: 'https://ibail.arpej.fr/residences/SA',
            },
            pictures: [{ url: 'https://images.example.com/sa.jpg' }],
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.235, 48.714] },
            properties: { city: 'Palaiseau', name: '26 Cours Pierre Vasseur', postcode: '91120' },
          },
        ],
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new ArrayBuffer(100),
    })

    const result = await command.execute({})

    expect(result.created).toBe(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Alexandre Manceau'))
    expect(created!.nbT1).toBe(259)
    expect(created!.nbT1Available).toBe(1)
    expect(created!.priceMinT1).toBe(381)
    expect(created!.priceMin).toBe(381)
    expect(created!.superficieMinT1).toBe(18)
    expect(created!.superficieMaxT1).toBe(48)
    expect(created!.imagesUrls).toEqual(['https://s3.example.com/test.jpg'])
    expect(created!.externalUrl).toBe('https://www.arpej.fr/fr/residence/alexandre-manceau-residence-etudiante-palaiseau/')
  })

  it('does not wipe existing description and images when current API sends no values', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-preserve-media', url: 'https://www.arpej.fr/fr/' })
    const existing = await createAccommodation({
      name: 'Résidence Conservée',
      slug: 'residence-conservee',
      description: 'Description existante',
      imagesUrls: ['https://s3.example.com/existing.jpg'],
      imagesCount: 1,
      postalCode: '75011',
    })
    await createExternalSource({ accommodationId: existing.id, source: 'arpej', sourceId: 'preserve-001' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'preserve-001',
            title: 'Résidence Conservée',
            address: '11 Rue Existante',
            zip_code: '75011',
            city: 'Paris',
            description: null,
            availability: {
              rent_amount_from: 500.4,
              accommodation_quantity: 10,
              count: 0,
            },
            pictures: [],
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.35, 48.86] },
            properties: { city: 'Paris', name: '11 Rue Existante', postcode: '75011' },
          },
        ],
      }),
    })

    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    expect(updated!.description).toBe('Description existante')
    expect(updated!.imagesUrls).toEqual(['https://s3.example.com/existing.jpg'])
    expect(updated!.imagesCount).toBe(1)
    expect(updated!.nbT1Available).toBe(0)
    expect(updated!.priceMinT1).toBe(500)
  })

  it('does not wipe existing scalar values when API sends null or omits fields', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-preserve-scalars', url: 'https://www.arpej.fr/fr/' })
    const academy = await createAcademy({ name: 'Académie Paris Preserve' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris Preserve' })
    const city = await createCity({ departmentId: department.id, name: 'Paris', slug: 'paris-preserve', postalCodes: ['75012'] })
    const existing = await createAccommodation({
      name: 'Résidence Valeurs',
      slug: 'residence-valeurs',
      nbT1: 42,
      nbT1Available: 7,
      nbTotalApartments: 42,
      priceMin: 430,
      priceMinT1: 430,
      priceMaxT1: 610,
      superficieMinT1: 18,
      superficieMaxT1: 32,
      cityId: city.id,
      postalCode: '75012',
    })
    await createExternalSource({ accommodationId: existing.id, source: 'arpej', sourceId: 'preserve-scalars-001' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'preserve-scalars-001',
            title: 'Résidence Valeurs',
            address: '12 Rue des Valeurs',
            zip_code: '75012',
            city: 'Paris',
            description: null,
            availability: {
              surface_from: null,
              surface_to: null,
              rent_amount_from: null,
              rent_amount_to: null,
              accommodation_quantity: null,
              count: null,
            },
            pictures: [],
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.39, 48.84] },
            properties: { city: 'Paris', name: '12 Rue des Valeurs', postcode: '75012' },
          },
        ],
      }),
    })

    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    expect(updated!.nbT1).toBe(42)
    expect(updated!.nbT1Available).toBe(7)
    expect(updated!.nbTotalApartments).toBe(42)
    expect(updated!.priceMin).toBe(430)
    expect(updated!.priceMinT1).toBe(430)
    expect(updated!.priceMaxT1).toBe(610)
    expect(updated!.superficieMinT1).toBe(18)
    expect(updated!.superficieMaxT1).toBe(32)
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
