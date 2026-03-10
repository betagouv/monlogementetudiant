import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createExternalSource, createOwner } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodations, externalSources, owners } from '../../../src/server/db/schema'

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
    ensureCity: vi.fn(async (_postalCode: string, cityName: string) => cityName),
  }
})

const { default: command } = await import('../import-csv')

function writeTmpCsv(rows: string[][], headers?: string[]): string {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')

  const defaultHeaders = [
    'name',
    'description',
    'address',
    'city',
    'postal_code',
    'residence_type',
    'latitude',
    'longitude',
    'owner_name',
    'owner_url',
    'nb_total_apartments',
    'nb_accessible_apartments',
    'nb_coliving_apartments',
    'nb_t1',
    't1_rent_min',
    't1_rent_max',
    'nb_t1_bis',
    't1_bis_rent_min',
    't1_bis_rent_max',
    'nb_t2',
    't2_rent_min',
    't2_rent_max',
    'nb_t3',
    't3_rent_min',
    't3_rent_max',
    'nb_t4',
    't4_rent_min',
    't4_rent_max',
    'nb_t5',
    't5_rent_min',
    't5_rent_max',
    'nb_t6',
    't6_rent_min',
    't6_rent_max',
    'nb_t7_more',
    't7_more_rent_min',
    't7_more_rent_max',
    'pictures',
    'laundry_room',
    'common_areas',
    'bike_storage',
    'parking',
    'secure_access',
    'residence_manager',
    'kitchen_type',
    'desk',
    'cooking_plates',
    'microwave',
    'refrigerator',
    'bathroom',
    'accept_waiting_list',
  ]

  const h = headers ?? defaultHeaders
  const lines = [h.join(';'), ...rows.map((r) => r.join(';'))]
  const filePath = path.join(os.tmpdir(), `import-csv-test-${Date.now()}.csv`)
  fs.writeFileSync(filePath, lines.join('\n'))
  return filePath
}

function makeRow(overrides: Record<string, string> = {}): string[] {
  const defaults: Record<string, string> = {
    name: 'Résidence Soleil',
    description: 'Belle résidence étudiante',
    address: '10 Rue du Soleil',
    city: 'Paris',
    postal_code: '75001',
    residence_type: 'residence-etudiante',
    latitude: '48.8566',
    longitude: '2.3522',
    owner_name: 'Mon Bailleur',
    owner_url: 'https://monbailleur.fr',
    nb_total_apartments: '20',
    nb_accessible_apartments: '2',
    nb_coliving_apartments: '3',
    nb_t1: '10',
    t1_rent_min: '400',
    t1_rent_max: '500',
    nb_t1_bis: '5',
    t1_bis_rent_min: '450',
    t1_bis_rent_max: '550',
    nb_t2: '3',
    t2_rent_min: '600',
    t2_rent_max: '700',
    nb_t3: '',
    t3_rent_min: '',
    t3_rent_max: '',
    nb_t4: '',
    t4_rent_min: '',
    t4_rent_max: '',
    nb_t5: '',
    t5_rent_min: '',
    t5_rent_max: '',
    nb_t6: '',
    t6_rent_min: '',
    t6_rent_max: '',
    nb_t7_more: '',
    t7_more_rent_min: '',
    t7_more_rent_max: '',
    pictures: '',
    laundry_room: 'oui',
    common_areas: 'oui',
    bike_storage: 'non',
    parking: 'oui',
    secure_access: 'oui',
    residence_manager: 'oui',
    kitchen_type: 'equipee',
    desk: 'oui',
    cooking_plates: 'oui',
    microwave: 'oui',
    refrigerator: 'oui',
    bathroom: 'douche',
    accept_waiting_list: 'oui',
  }

  const merged = { ...defaults, ...overrides }

  const headers = [
    'name',
    'description',
    'address',
    'city',
    'postal_code',
    'residence_type',
    'latitude',
    'longitude',
    'owner_name',
    'owner_url',
    'nb_total_apartments',
    'nb_accessible_apartments',
    'nb_coliving_apartments',
    'nb_t1',
    't1_rent_min',
    't1_rent_max',
    'nb_t1_bis',
    't1_bis_rent_min',
    't1_bis_rent_max',
    'nb_t2',
    't2_rent_min',
    't2_rent_max',
    'nb_t3',
    't3_rent_min',
    't3_rent_max',
    'nb_t4',
    't4_rent_min',
    't4_rent_max',
    'nb_t5',
    't5_rent_min',
    't5_rent_max',
    'nb_t6',
    't6_rent_min',
    't6_rent_max',
    'nb_t7_more',
    't7_more_rent_min',
    't7_more_rent_max',
    'pictures',
    'laundry_room',
    'common_areas',
    'bike_storage',
    'parking',
    'secure_access',
    'residence_manager',
    'kitchen_type',
    'desk',
    'cooking_plates',
    'microwave',
    'refrigerator',
    'bathroom',
    'accept_waiting_list',
  ]

  return headers.map((h) => merged[h] ?? '')
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('import-csv integration', () => {
  it('creates accommodation and external source from CSV file', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([makeRow()])

    const result = await command.execute({ file: filePath, source: 'test-source', verbose: true })

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const accs = await db.select().from(accommodations)
    const created = accs.find((a) => a.name === 'Résidence Soleil')
    expect(created).toBeDefined()
    expect(created!.postalCode).toBe('75001')
    expect(created!.residenceType).toBe('residence-etudiante')
    expect(created!.published).toBe(true)
    expect(created!.nbT1).toBe(10)
    expect(created!.nbT1Bis).toBe(5)
    expect(created!.nbT2).toBe(3)
    expect(created!.priceMinT1).toBe(400)
    expect(created!.priceMaxT1).toBe(500)
    expect(created!.priceMin).toBe(400)
    expect(created!.nbTotalApartments).toBe(20)
    expect(created!.nbAccessibleApartments).toBe(2)
    expect(created!.nbColivingApartments).toBe(3)
    expect(created!.laundryRoom).toBe(true)
    expect(created!.commonAreas).toBe(true)
    expect(created!.bikeStorage).toBe(false)
    expect(created!.parking).toBe(true)
    expect(created!.secureAccess).toBe(true)
    expect(created!.residenceManager).toBe(true)
    expect(created!.kitchenType).toBe('equipee')
    expect(created!.desk).toBe(true)
    expect(created!.cookingPlates).toBe(true)
    expect(created!.microwave).toBe(true)
    expect(created!.refrigerator).toBe(true)
    expect(created!.bathroom).toBe('douche')
    expect(created!.acceptWaitingList).toBe(true)
    expect(created!.externalUrl).toBe('https://monbailleur.fr')

    const sources = await db.select().from(externalSources).where(eq(externalSources.source, 'test-source'))
    expect(sources).toHaveLength(1)
    expect(sources[0].accommodationId).toBe(created!.id)
  })

  it('creates owner from CSV data', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([makeRow({ owner_name: 'Nouveau Bailleur', owner_url: 'https://nouveau.fr' })])

    await command.execute({ file: filePath, source: 'test-owner' })

    const ownerRows = await db.select().from(owners).where(eq(owners.name, 'Nouveau Bailleur'))
    expect(ownerRows).toHaveLength(1)
    expect(ownerRows[0].url).toBe('https://nouveau.fr')
  })

  it('reuses existing owner', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Mon Bailleur', slug: 'mon-bailleur' })

    const filePath = writeTmpCsv([makeRow()])
    await command.execute({ file: filePath, source: 'test-reuse' })

    const ownerRows = await db.select().from(owners).where(eq(owners.name, 'Mon Bailleur'))
    expect(ownerRows).toHaveLength(1)
  })

  it('updates existing accommodation on re-import', async () => {
    const db = getTestDb()

    const filePath1 = writeTmpCsv([makeRow({ name: 'Résidence Lune', nb_t1: '10' })])
    await command.execute({ file: filePath1, source: 'test-update' })

    const filePath2 = writeTmpCsv([makeRow({ name: 'Résidence Lune', nb_t1: '20' })])
    const result = await command.execute({ file: filePath2, source: 'test-update' })

    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)

    const sources = await db.select().from(externalSources).where(eq(externalSources.source, 'test-update'))
    expect(sources).toHaveLength(1)

    const acc = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    expect(acc[0].nbT1).toBe(20)
  })

  it('uses lat/lng from CSV when present', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([makeRow({ latitude: '43.6047', longitude: '1.4442' })])

    await command.execute({ file: filePath, source: 'test-geo' })

    // No geocoder fetch should have been called
    expect(mockFetch).not.toHaveBeenCalled()

    const accs = await db.select().from(accommodations)
    expect(accs).toHaveLength(1)
  })

  it('falls back to geocoder when lat/lng missing', async () => {
    const db = getTestDb()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            properties: {
              city: 'Paris',
              name: '10 Rue du Soleil',
              postcode: '75001',
            },
          },
        ],
      }),
    })

    const filePath = writeTmpCsv([makeRow({ latitude: '', longitude: '' })])

    await command.execute({ file: filePath, source: 'test-geocoder' })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    const accs = await db.select().from(accommodations)
    expect(accs).toHaveLength(1)
  })

  it('dry-run does not modify the database', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([makeRow(), makeRow({ name: 'Résidence Deux' })])

    const result = await command.execute({ file: filePath, source: 'test-dry', dryRun: true, verbose: true })

    expect(result.created).toBe(2)

    const sources = await db.select().from(externalSources).where(eq(externalSources.source, 'test-dry'))
    expect(sources).toHaveLength(0)

    const ownerRows = await db.select().from(owners)
    expect(ownerRows).toHaveLength(0)
  })

  it('respects --limit option', async () => {
    const filePath = writeTmpCsv([makeRow({ name: 'Résidence A' }), makeRow({ name: 'Résidence B' }), makeRow({ name: 'Résidence C' })])

    const result = await command.execute({ file: filePath, source: 'test-limit', dryRun: true, limit: 1 })

    expect(result.created).toBe(1)
  })

  it('handles mixed create/update', async () => {
    const owner = await createOwner({ name: 'Mon Bailleur', slug: 'mon-bailleur-mix' })

    // Create an existing accommodation with known sourceId
    const existing = await createAccommodation({
      name: 'Résidence Existante',
      slug: 'residence-existante',
      ownerId: owner.id,
    })
    await createExternalSource({
      accommodationId: existing.id,
      source: 'test-mix',
      sourceId: existing.externalReference ?? undefined,
    })

    // We need to generate the same sourceId, which is hash of name+address+postal_code
    // Simpler: just import two new rows under test-mix source
    const filePath = writeTmpCsv([makeRow({ name: 'Résidence Nouvelle 1' }), makeRow({ name: 'Résidence Nouvelle 2' })])

    const result = await command.execute({ file: filePath, source: 'test-mix', verbose: true })

    expect(result.created).toBe(2)
  })

  it('parses boolean values correctly', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([
      makeRow({
        laundry_room: 'vrai',
        common_areas: 'true',
        bike_storage: '1',
        parking: 'yes',
        secure_access: 'non',
        residence_manager: 'false',
      }),
    ])

    await command.execute({ file: filePath, source: 'test-bool' })

    const accs = await db.select().from(accommodations)
    const acc = accs[0]
    expect(acc.laundryRoom).toBe(true)
    expect(acc.commonAreas).toBe(true)
    expect(acc.bikeStorage).toBe(true)
    expect(acc.parking).toBe(true)
    expect(acc.secureAccess).toBe(false)
    expect(acc.residenceManager).toBe(false)
  })

  it('parses digit values with euro sign and commas', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([
      makeRow({
        t1_rent_min: '400€',
        t1_rent_max: '500,00',
        nb_t1: '10',
      }),
    ])

    await command.execute({ file: filePath, source: 'test-digit' })

    const accs = await db.select().from(accommodations)
    expect(accs[0].priceMinT1).toBe(400)
    expect(accs[0].priceMaxT1).toBe(500)
    expect(accs[0].nbT1).toBe(10)
  })

  it('handles pictures with S3 URLs (kept as-is)', async () => {
    const db = getTestDb()

    const s3Url = 'https://s3.gra.io.cloud.ovh.net/bucket/accommodations/image1.jpg'
    const filePath = writeTmpCsv([makeRow({ pictures: s3Url })])

    await command.execute({ file: filePath, source: 'test-s3-pic' })

    const accs = await db.select().from(accommodations)
    expect(accs[0].imagesUrls).toContain(s3Url)
    expect(accs[0].imagesCount).toBe(1)
  })

  it('handles pictures with external URLs (re-uploaded)', async () => {
    const db = getTestDb()

    // Mock the external image download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    })

    const filePath = writeTmpCsv([makeRow({ pictures: 'https://flatbay.fr/images/photo.jpg' })])

    await command.execute({ file: filePath, source: 'test-ext-pic' })

    expect(mockFetch).toHaveBeenCalledWith('https://flatbay.fr/images/photo.jpg')

    const accs = await db.select().from(accommodations)
    expect(accs[0].imagesUrls).toHaveLength(1)
    expect(accs[0].imagesUrls![0]).toContain('s3.gra.io.cloud.ovh.net')
    expect(accs[0].imagesCount).toBe(1)
  })

  it('handles multiple pictures separated by pipe', async () => {
    const db = getTestDb()

    const s3Url1 = 'https://s3.gra.io.cloud.ovh.net/bucket/img1.jpg'
    const s3Url2 = 'https://s3.gra.io.cloud.ovh.net/bucket/img2.jpg'
    const filePath = writeTmpCsv([makeRow({ pictures: `${s3Url1}|${s3Url2}` })])

    await command.execute({ file: filePath, source: 'test-multi-pic' })

    const accs = await db.select().from(accommodations)
    expect(accs[0].imagesUrls).toHaveLength(2)
    expect(accs[0].imagesCount).toBe(2)
  })

  it('handles BOM-encoded CSV', async () => {
    const fs = require('node:fs')
    const os = require('node:os')
    const path = require('node:path')

    const headers = [
      'name',
      'description',
      'address',
      'city',
      'postal_code',
      'residence_type',
      'latitude',
      'longitude',
      'owner_name',
      'owner_url',
      'nb_total_apartments',
      'nb_accessible_apartments',
      'nb_coliving_apartments',
      'nb_t1',
      't1_rent_min',
      't1_rent_max',
      'nb_t1_bis',
      't1_bis_rent_min',
      't1_bis_rent_max',
      'nb_t2',
      't2_rent_min',
      't2_rent_max',
      'nb_t3',
      't3_rent_min',
      't3_rent_max',
      'nb_t4',
      't4_rent_min',
      't4_rent_max',
      'nb_t5',
      't5_rent_min',
      't5_rent_max',
      'nb_t6',
      't6_rent_min',
      't6_rent_max',
      'nb_t7_more',
      't7_more_rent_min',
      't7_more_rent_max',
      'pictures',
      'laundry_room',
      'common_areas',
      'bike_storage',
      'parking',
      'secure_access',
      'residence_manager',
      'kitchen_type',
      'desk',
      'cooking_plates',
      'microwave',
      'refrigerator',
      'bathroom',
      'accept_waiting_list',
    ]

    const row = makeRow({ name: 'Résidence BOM' })
    const content = '\uFEFF' + headers.join(';') + '\n' + row.join(';')
    const filePath = path.join(os.tmpdir(), `import-csv-bom-${Date.now()}.csv`)
    fs.writeFileSync(filePath, content)

    const result = await command.execute({ file: filePath, source: 'test-bom' })

    expect(result.created).toBe(1)

    const db = getTestDb()
    const accs = await db.select().from(accommodations)
    expect(accs.find((a) => a.name === 'Résidence BOM')).toBeDefined()
  })

  it('derives nbTotalApartments from typology when not in CSV', async () => {
    const db = getTestDb()

    const filePath = writeTmpCsv([
      makeRow({
        nb_total_apartments: '',
        nb_t1: '10',
        nb_t1_bis: '5',
        nb_t2: '3',
      }),
    ])

    await command.execute({ file: filePath, source: 'test-derived' })

    const accs = await db.select().from(accommodations)
    expect(accs[0].nbTotalApartments).toBe(18) // 10 + 5 + 3
  })

  it('throws when --file is missing', async () => {
    await expect(command.execute({ source: 'test' })).rejects.toThrow('--file')
  })

  it('throws when --source is missing', async () => {
    await expect(command.execute({ file: '/tmp/test.csv' })).rejects.toThrow('--source')
  })

  it('records errors without stopping the import', async () => {
    const filePath = writeTmpCsv([
      makeRow({ name: 'Bonne Résidence' }),
      makeRow({ name: '' }), // will be skipped (empty name)
      makeRow({ name: 'Autre Résidence' }),
    ])

    const result = await command.execute({ file: filePath, source: 'test-errors', verbose: true })

    expect(result.created).toBe(2)
    expect(result.skipped).toBe(1)
  })

  it('handles CSV with code column for sourceId', async () => {
    const db = getTestDb()

    const headers = [
      'code',
      'name',
      'description',
      'address',
      'city',
      'postal_code',
      'residence_type',
      'latitude',
      'longitude',
      'owner_name',
      'owner_url',
      'nb_total_apartments',
      'nb_accessible_apartments',
      'nb_coliving_apartments',
      'nb_t1',
      't1_rent_min',
      't1_rent_max',
      'nb_t1_bis',
      't1_bis_rent_min',
      't1_bis_rent_max',
      'nb_t2',
      't2_rent_min',
      't2_rent_max',
      'nb_t3',
      't3_rent_min',
      't3_rent_max',
      'nb_t4',
      't4_rent_min',
      't4_rent_max',
      'nb_t5',
      't5_rent_min',
      't5_rent_max',
      'nb_t6',
      't6_rent_min',
      't6_rent_max',
      'nb_t7_more',
      't7_more_rent_min',
      't7_more_rent_max',
      'pictures',
      'laundry_room',
      'common_areas',
      'bike_storage',
      'parking',
      'secure_access',
      'residence_manager',
      'kitchen_type',
      'desk',
      'cooking_plates',
      'microwave',
      'refrigerator',
      'bathroom',
      'accept_waiting_list',
    ]

    const row = ['ABC-123', ...makeRow()]
    const filePath = writeTmpCsv([row], headers)

    await command.execute({ file: filePath, source: 'test-code' })

    const sources = await db
      .select()
      .from(externalSources)
      .where(and(eq(externalSources.source, 'test-code'), eq(externalSources.sourceId, 'ABC-123')))
    expect(sources).toHaveLength(1)
  })
})
