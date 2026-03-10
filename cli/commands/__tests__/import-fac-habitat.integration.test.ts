import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createExternalSource, createOwner } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodations, externalSources } from '../../../src/server/db/schema'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const testDb = getTestDb()

vi.mock('../../lib/db', () => ({
  db: testDb,
  closeDb: vi.fn(),
}))

vi.mock('ssh2-sftp-client', () => ({
  default: vi.fn(),
}))

const { default: command } = await import('../import-fac-habitat')

function mockGeocoder(overrides: { city?: string; address?: string; postcode?: string; coordinates?: [number, number] } = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      features: [
        {
          geometry: { type: 'Point', coordinates: overrides.coordinates ?? [2.3522, 48.8566] },
          properties: {
            city: overrides.city ?? 'Paris',
            name: overrides.address ?? '10 Rue du Test',
            postcode: overrides.postcode ?? '75001',
          },
        },
      ],
    }),
  })
}

function writeTmpJson(data: unknown[]): string {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const filePath = path.join(os.tmpdir(), `fac-habitat-test-${Date.now()}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data))
  return filePath
}

function makeResidence(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Résidence Soleil',
    address: '10 Rue du Soleil',
    city: 'Paris',
    postal_code: '75001',
    nb_t1: 10,
    nb_t2: 5,
    nb_t1_rent_min: 400,
    nb_t1_rent_max: 500,
    nb_t2_rent_min: 600,
    nb_t2_rent_max: 700,
    nb_total_apartments: 15,
    laundry_room: true,
    parking: false,
    residence_manager: true,
    kitchen_type: 'equipee',
    refrigerator: true,
    bathroom: 'douche',
    accept_waiting_list: true,
    nb_accessible_apartments: 2,
    nb_coliving_apartments: 3,
    ...overrides,
  }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('import-fac-habitat integration', () => {
  it('creates accommodation and external source from JSON file', async () => {
    const db = getTestDb()

    await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat' })

    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ file: filePath, verbose: true })

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const accs = await db.select().from(accommodations)
    const created = accs.find((a) => a.name === 'Résidence Soleil')
    expect(created).toBeDefined()
    expect(created!.postalCode).toBe('75001')
    expect(created!.residenceType).toBe('residence-etudiante')
    expect(created!.published).toBe(true)
    expect(created!.nbT1).toBe(10)
    expect(created!.nbT2).toBe(5)
    expect(created!.priceMinT1).toBe(400)
    expect(created!.priceMaxT1).toBe(500)
    expect(created!.laundryRoom).toBe(true)
    expect(created!.parking).toBe(false)
    expect(created!.residenceManager).toBe(true)
    expect(created!.kitchenType).toBe('equipee')
    expect(created!.refrigerator).toBe(true)
    expect(created!.bathroom).toBe('douche')
    expect(created!.acceptWaitingList).toBe(true)
    expect(created!.nbAccessibleApartments).toBe(2)
    expect(created!.nbColivingApartments).toBe(3)
    expect(created!.externalReference).toBe('1')

    const sources = await db
      .select()
      .from(externalSources)
      .where(and(eq(externalSources.source, 'fac-habitat'), eq(externalSources.sourceId, '1')))
    expect(sources).toHaveLength(1)
    expect(sources[0].accommodationId).toBe(created!.id)
  })

  it('updates existing accommodation on re-import', async () => {
    const db = getTestDb()

    await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat-2' })

    const filePath1 = writeTmpJson([makeResidence({ id: 42, name: 'Résidence Lune' })])
    mockGeocoder()

    await command.execute({ file: filePath1 })

    const filePath2 = writeTmpJson([makeResidence({ id: 42, name: 'Résidence Lune Rénovée', nb_t1: 20 })])
    mockGeocoder()

    const result = await command.execute({ file: filePath2 })

    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, '42'))
    expect(sources).toHaveLength(1)

    const acc = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    expect(acc[0].name).toBe('Résidence Lune Rénovée')
    expect(acc[0].nbT1).toBe(20)
  })

  it('creates owner if it does not exist', async () => {
    const db = getTestDb()

    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ file: filePath })

    expect(result.created).toBe(1)

    const ownerRows = await db
      .select()
      .from((await import('../../../src/server/db/schema')).owners)
      .where(eq((await import('../../../src/server/db/schema')).owners.name, 'FAC HABITAT'))
    expect(ownerRows).toHaveLength(1)
    expect(ownerRows[0].slug).toBe('fac-habitat')
  })

  it('handles typology grouping correctly', async () => {
    const db = getTestDb()

    await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat-typo' })

    const residence = makeResidence({
      id: 100,
      // T1 bis = nb_t1_bis + nb_t1_prime + nb_studio_double
      nb_t1_bis: 3,
      nb_t1_prime: 2,
      nb_studio_double: 1,
      nb_t1_bis_rent_min: 350,
      nb_t1_prime_rent_min: 300,
      nb_studio_double_rent_min: 400,
      nb_t1_bis_rent_max: 500,
      nb_t1_prime_rent_max: 450,
      nb_studio_double_rent_max: 550,
      // T2 = nb_t2 + nb_t2_duplex + nb_duplex
      nb_t2: 2,
      nb_t2_duplex: 1,
      nb_duplex: 1,
      nb_t2_rent_min: 600,
      nb_t2_duplex_rent_min: 650,
      nb_duplex_rent_min: 700,
      // T3 = nb_t3 + nb_duo
      nb_t3: 4,
      nb_duo: 2,
      // T5 = nb_t5 + nb_t5_en_colocation
      nb_t5: 1,
      nb_t5_en_colocation: 2,
    })

    const filePath = writeTmpJson([residence])
    mockGeocoder()

    await command.execute({ file: filePath })

    const accs = await db.select().from(accommodations)
    const acc = accs.find((a) => a.externalReference === '100')
    expect(acc).toBeDefined()
    expect(acc!.nbT1Bis).toBe(6) // 3 + 2 + 1
    expect(acc!.nbT2).toBe(4) // 2 + 1 + 1
    expect(acc!.nbT3).toBe(6) // 4 + 2
    expect(acc!.nbT5).toBe(3) // 1 + 2
    expect(acc!.priceMinT1Bis).toBe(300) // min(350, 300, 400)
    expect(acc!.priceMaxT1Bis).toBe(550) // max(500, 450, 550)
    expect(acc!.priceMinT2).toBe(600) // min(600, 650, 700)
  })

  it('dry-run does not modify the database', async () => {
    const db = getTestDb()

    await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat-dry' })

    const filePath = writeTmpJson([makeResidence({ id: 200 }), makeResidence({ id: 201 })])
    mockGeocoder()
    mockGeocoder()

    const result = await command.execute({ file: filePath, dryRun: true, verbose: true })

    expect(result.created).toBe(2)

    const sources = await db.select().from(externalSources).where(eq(externalSources.source, 'fac-habitat'))
    expect(sources).toHaveLength(0)
  })

  it('respects --limit option', async () => {
    const filePath = writeTmpJson([makeResidence({ id: 301 }), makeResidence({ id: 302 }), makeResidence({ id: 303 })])
    mockGeocoder()

    const result = await command.execute({ file: filePath, dryRun: true, limit: 1 })

    expect(result.created).toBe(1)
  })

  it('handles multiple residences with mixed create/update', async () => {
    const db = getTestDb()

    const owner = await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat-mix' })

    const existing = await createAccommodation({
      name: 'Résidence Existante',
      slug: 'residence-existante',
      ownerId: owner.id,
    })
    await createExternalSource({
      accommodationId: existing.id,
      source: 'fac-habitat',
      sourceId: '501',
    })

    const filePath = writeTmpJson([
      makeResidence({ id: 501, name: 'Résidence Existante MAJ' }),
      makeResidence({ id: 502, name: 'Résidence Nouvelle' }),
    ])
    mockGeocoder()
    mockGeocoder()

    const result = await command.execute({ file: filePath, verbose: true })

    expect(result.updated).toBe(1)
    expect(result.created).toBe(1)

    const updated = await db.select().from(accommodations).where(eq(accommodations.id, existing.id))
    expect(updated[0].name).toBe('Résidence Existante MAJ')
  })

  it('records errors without stopping the import', async () => {
    await createOwner({ name: 'FAC HABITAT', slug: 'fac-habitat-err' })

    const filePath = writeTmpJson([makeResidence({ id: 601 }), makeResidence({ id: 602 })])

    mockFetch.mockResolvedValueOnce({ ok: false })
    mockGeocoder()

    const result = await command.execute({ file: filePath, verbose: true })

    expect(result.errors).toHaveLength(0)
    expect(result.created).toBe(2)
  })

  it('throws when --file is missing and SFTP env vars are not set', async () => {
    delete process.env.FAC_HABITAT_SFTP_HOST
    delete process.env.FAC_HABITAT_SFTP_USERNAME

    await expect(command.execute({})).rejects.toThrow('FAC_HABITAT_SFTP_HOST')
  })
})
