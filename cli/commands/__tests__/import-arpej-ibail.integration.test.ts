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
import { createGeocodingStub } from '../../../src/__tests__/helpers/geocoding-stub'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodationAddresses, accommodations, externalSources } from '../../../src/server/db/schema'
import { typologiesByType, typologyDraft } from '../../../src/server/lib/typologies'

async function loadTypologies(accommodationId: number) {
  const row = await getTestDb().query.accommodations.findFirst({
    where: eq(accommodations.id, accommodationId),
    with: { typologies: true },
  })
  return typologiesByType(row?.typologies ?? [])
}

// Communes et adresses connues du géocodage pendant ces tests. Le stub répond
// par URL : l'import interroge geo.api.gouv.fr puis la BAN pour une seule
// adresse, et met les communes en cache, donc `mockFetch` ne peut pas servir
// ces réponses dans un ordre fixe.
const geocoding = createGeocodingStub([
  { postalCode: '75001', city: 'Paris', inseeCode: '75101', lat: 48.8566, lng: 2.3522 },
  { postalCode: '75002', city: 'Paris', inseeCode: '75102', lat: 48.86, lng: 2.35 },
  { postalCode: '75010', city: 'Paris', inseeCode: '75110', lat: 48.876, lng: 2.359 },
  { postalCode: '75011', city: 'Paris', inseeCode: '75111', lat: 48.86, lng: 2.35 },
  { postalCode: '75012', city: 'Paris', inseeCode: '75112', lat: 48.84, lng: 2.39 },
  { postalCode: '91120', city: 'Palaiseau', inseeCode: '91477', lat: 48.714, lng: 2.235 },
  { postalCode: '59100', city: 'Roubaix', inseeCode: '59512', lat: 50.692, lng: 3.174 },
])

const mockFetch = vi.fn()
vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) =>
  geocoding.handles(args[0]) ? geocoding.respond(args[0]) : mockFetch(...args),
)

vi.mock('../../../src/server/services/s3', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/test.jpg'),
  generateAccommodationKey: vi.fn().mockReturnValue('test-key.jpg'),
}))

const { default: command } = await import('../import-arpej-ibail')

beforeEach(() => {
  mockFetch.mockReset()
  geocoding.reset()
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
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new ArrayBuffer(100),
    })

    const result = await command.execute({})

    expect(result.created).toBe(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Alexandre Manceau'))
    const typos = await loadTypologies(created!.id)
    expect(typos.t1?.nbTotal).toBe(259)
    expect(typos.t1?.nbAvailable).toBe(1)
    expect(typos.t1?.priceMin).toBe(381)
    expect(created!.priceMin).toBe(381)
    expect(typos.t1?.superficieMin).toBe(18)
    expect(typos.t1?.superficieMax).toBe(48)
    expect(created!.imagesUrls).toEqual(['https://s3.example.com/test.jpg'])

    // Le point retenu est celui que la BAN confirme dans une commune du code postal.
    expect(geocoding.searchCalls).toHaveLength(1)
    const [addr] = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, created!.id))
    expect(addr.postalCode).toBe('91120')
    expect(addr.cityId).not.toBeNull()
    expect(created!.externalUrl).toBe('https://www.arpej.fr/fr/residence/alexandre-manceau-residence-etudiante-palaiseau/')
  })

  it('uses current availability count over legacy available accommodation quantity', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-current-availability', url: 'https://www.arpej.fr/fr/' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        residences: [
          {
            key: 'RO',
            title: 'Résidence Jacky Dodin',
            address: '44 rue de la Guinguette',
            address_complement: null,
            zip_code: '59100',
            city: 'Roubaix',
            available_accommodation_quantity: 0,
            availability: {
              surface_from: 19.04,
              surface_to: 44.72,
              rent_amount_from: 479.89,
              accommodation_quantity: 149,
              count: 4,
              url: 'https://ibail.arpej.fr/residences/RO',
            },
            pictures: [],
          },
        ],
      }),
      headers: new Headers({ 'X-Pagination-Total-Pages': '1' }),
    })

    const result = await command.execute({})

    expect(result.created).toBe(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Jacky Dodin'))
    const typos = await loadTypologies(created!.id)
    expect(typos.t1?.nbTotal).toBe(149)
    expect(typos.t1?.nbAvailable).toBe(4)
    expect(created!.nbTotalApartments).toBe(149)
  })

  it('does not wipe existing description and images when current API sends no values', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-preserve-media', url: 'https://www.arpej.fr/fr/' })
    const existing = await createAccommodation({
      name: 'Résidence Conservée',
      slug: 'residence-conservee',
      description: 'Description existante',
      imagesUrls: ['https://s3.example.com/existing.jpg'],
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
    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    expect(updated!.description).toBe('Description existante')
    expect(updated!.imagesUrls).toEqual(['https://s3.example.com/existing.jpg'])
    const typos = await loadTypologies(updated!.id)
    expect(typos.t1?.nbAvailable).toBe(0)
    expect(typos.t1?.priceMin).toBe(500)
  })

  it('does not wipe existing scalar values when API sends null or omits fields', async () => {
    const db = getTestDb()

    await createOwner({ name: 'ARPEJ', slug: 'arpej-preserve-scalars', url: 'https://www.arpej.fr/fr/' })
    const academy = await createAcademy({ name: 'Académie Paris Preserve' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris Preserve' })
    const city = await createCity({ departmentId: department.id, name: 'Paris', slug: 'paris-preserve', postalCodes: ['75012'] })
    const existing = await createAccommodation(
      {
        name: 'Résidence Valeurs',
        slug: 'residence-valeurs',
        nbTotalApartments: 42,
        priceMin: 430,
        cityId: city.id,
        postalCode: '75012',
      },
      [typologyDraft('t1', { nbTotal: 42, nbAvailable: 7, priceMin: 430, priceMax: 610, superficieMin: 18, superficieMax: 32 })],
    )
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
    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    const typos = await loadTypologies(updated!.id)
    expect(typos.t1?.nbTotal).toBe(42)
    expect(typos.t1?.nbAvailable).toBe(7)
    expect(updated!.nbTotalApartments).toBe(42)
    expect(updated!.priceMin).toBe(430)
    expect(typos.t1?.priceMin).toBe(430)
    expect(typos.t1?.priceMax).toBe(610)
    expect(typos.t1?.superficieMin).toBe(18)
    expect(typos.t1?.superficieMax).toBe(32)
  })

  it('updates existing accommodation on re-import without changing its name', async () => {
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
    const result = await command.execute({})

    expect(result.updated).toBe(1)

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, 'res-002'))
    expect(sources).toHaveLength(1)

    const acc = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    expect(acc[0].name).toBe('Résidence Lune')
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
