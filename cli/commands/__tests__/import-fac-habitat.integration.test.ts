import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createExternalSource, createOwner } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { accommodationAddresses, accommodations, externalSources, owners } from '../../../src/server/db/schema'
import { typologiesByType } from '../../../src/server/lib/typologies'

async function loadTypologies(accommodationId: number) {
  const row = await getTestDb().query.accommodations.findFirst({
    where: eq(accommodations.id, accommodationId),
    with: { typologies: true },
  })
  return typologiesByType(row?.typologies ?? [])
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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
    t1_rent_min: 400,
    t1_rent_max: 500,
    t2_rent_min: 600,
    t2_rent_max: 700,
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
  it('resolves the owner by slug even when it was renamed (chemin des crons)', async () => {
    const db = getTestDb()

    const owner = await createOwner({ name: 'FAC HABITAT (renommé)', slug: 'fac-habitat' })

    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ file: filePath, ownerSlug: 'fac-habitat', verbose: true })

    expect(result.errors).toHaveLength(0)
    expect(result.ownerId).toBe(owner.id)
    expect(result.ownerName).toBe('FAC HABITAT (renommé)')

    // Le nom codé en dur dans la commande ne doit pas créer de second bailleur.
    expect(await db.select().from(owners).where(eq(owners.name, 'Fac-Habitat'))).toHaveLength(0)
  })

  it('fails when the owner slug is unknown', async () => {
    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    await expect(command.execute({ file: filePath, ownerSlug: 'bailleur-inexistant' })).rejects.toThrow(
      'Bailleur introuvable : slug=bailleur-inexistant',
    )
  })

  it('creates accommodation and external source from JSON file', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat' })

    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ file: filePath, verbose: true })

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.name, 'Résidence Soleil'))
    expect(created).toBeDefined()

    const [addr] = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, created!.id))
    expect(addr.postalCode).toBe('75001')
    expect(created!.residenceType).toBe('residence-etudiante')
    expect(created!.published).toBe(true)
    const typos = await loadTypologies(created!.id)
    expect(typos.t1?.nbTotal).toBe(10)
    expect(typos.t2?.nbTotal).toBe(5)
    expect(typos.t1?.priceMin).toBe(400)
    expect(typos.t1?.priceMax).toBe(500)
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

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-2' })

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
    expect((await loadTypologies(acc[0].id)).t1?.nbTotal).toBe(20)
  })

  it('creates owner if it does not exist', async () => {
    const db = getTestDb()

    const filePath = writeTmpJson([makeResidence()])
    mockGeocoder()

    const result = await command.execute({ file: filePath })

    expect(result.created).toBe(1)

    const ownerRows = await db.select().from(owners).where(eq(owners.name, 'Fac-Habitat'))
    expect(ownerRows).toHaveLength(1)
    expect(ownerRows[0].slug).toBe('fac-habitat')
  })

  it('handles typology grouping correctly', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-typo' })

    const residence = makeResidence({
      id: 100,
      // T1 bis = nb_t1_bis + nb_t1_prime + nb_studio_double
      nb_t1_bis: 3,
      nb_t1_prime: 2,
      nb_studio_double: 1,
      t1_bis_rent_min: 350,
      t1_prime_rent_min: 300,
      studio_double_rent_min: 400,
      t1_bis_rent_max: 500,
      t1_prime_rent_max: 450,
      studio_double_rent_max: 550,
      // T2 = nb_t2 + nb_t2_duplex + nb_duplex
      nb_t2: 2,
      nb_t2_duplex: 1,
      nb_duplex: 1,
      t2_rent_min: 600,
      t2_duplex_rent_min: 650,
      duplex_rent_min: 700,
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
    const typos = await loadTypologies(acc!.id)
    expect(typos.t1_bis?.nbTotal).toBe(7) // 3 + 2 + 1 + 1
    expect(typos.t2?.nbTotal).toBe(3) // 2 + 1
    expect(typos.t3?.nbTotal).toBe(6) // 4 + 2
    expect(typos.t5?.nbTotal).toBe(3) // 1 + 2
    expect(typos.t1_bis?.priceMin).toBe(300) // min(350, 300, 400)
    expect(typos.t1_bis?.priceMax).toBe(550) // max(500, 450, 550)
    expect(typos.t2?.priceMin).toBe(600) // min(600, 650, 700)
  })

  it('dry-run does not modify the database', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-dry' })

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

    const owner = await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-mix' })

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
    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-err' })

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

  it('Available fields: null when all sources absent, sum (incl. 0) when any present', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-available' })

    const residence = makeResidence({
      id: 9001,
      // T1Bis Available: undefined + 5 + null + undefined => 5
      nb_t1_bis_available: undefined,
      nb_t1_prime_available: 5,
      nb_studio_double_available: null,
      nb_duplex_available: undefined,
      // T2 Available: 0 + null => 0
      nb_t2_available: 0,
      nb_t2_duplex_available: null,
      // T3 Available: undefined + null => null
      nb_t3_available: undefined,
      nb_duo_available: null,
    })

    const filePath = writeTmpJson([residence])
    mockGeocoder()

    await command.execute({ file: filePath })

    const [acc] = await db.select().from(accommodations).where(eq(accommodations.externalReference, '9001'))
    expect(acc).toBeDefined()
    const typos = await loadTypologies(acc!.id)
    expect(typos.t1_bis?.nbAvailable).toBe(5)
    expect(typos.t2?.nbAvailable).toBe(0)
    // t3 has no stock → no typology row exists
    expect(typos.t3).toBeUndefined()
  })

  it('forces 0 available on a type that does not accept applications', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-wl' })

    const residence = makeResidence({
      id: 9101,
      accept_waiting_list: true,
      nb_t1_available: 4,
      t1_accept_waiting_list: false,
      nb_t2_available: 2,
      t2_accept_waiting_list: true,
      nb_t1_prime: 1,
      nb_t1_prime_available: 3,
      t1_prime_accept_waiting_list: false,
      nb_duplex: 1,
      nb_duplex_available: 1,
      duplex_accept_waiting_list: true,
    })

    mockGeocoder()
    await command.execute({ file: writeTmpJson([residence]) })

    const [acc] = await db.select().from(accommodations).where(eq(accommodations.externalReference, '9101'))
    const typos = await loadTypologies(acc!.id)
    expect(typos.t1?.nbAvailable).toBe(0)
    expect(typos.t2?.nbAvailable).toBe(2)
    expect(typos.t1_bis?.nbAvailable).toBe(1)
    expect(acc!.acceptWaitingList).toBe(true)
  })

  it('derives the residence waiting list from the types when they are provided', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-wl-res' })

    mockGeocoder()
    mockGeocoder()
    await command.execute({
      file: writeTmpJson([
        makeResidence({ id: 9201, accept_waiting_list: true, t1_accept_waiting_list: false, t2_accept_waiting_list: false }),
        makeResidence({ id: 9202, accept_waiting_list: false, t1_accept_waiting_list: false, t2_accept_waiting_list: true }),
      ]),
    })

    const [allClosed] = await db.select().from(accommodations).where(eq(accommodations.externalReference, '9201'))
    const oneOpen = await db.select().from(accommodations).where(eq(accommodations.externalReference, '9202'))
    expect(allClosed!.acceptWaitingList).toBe(false)
    expect(oneOpen[0]!.acceptWaitingList).toBe(true)
  })

  it('reports a malformed row without stopping the import', async () => {
    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-invalid' })

    mockGeocoder()
    const result = await command.execute({
      file: writeTmpJson([makeResidence({ id: 9301, nb_t1: 'dix' }), makeResidence({ id: 9302 })]),
    })

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('nb_t1')
  })

  it('slug must not change on re-import with same name', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Fac-Habitat', slug: 'fac-habitat-slug' })

    const residence = makeResidence({ id: 7001, name: 'Résidence Stabilité' })

    // First import: create
    const filePath1 = writeTmpJson([residence])
    mockGeocoder()
    await command.execute({ file: filePath1 })

    const sources = await db.select().from(externalSources).where(eq(externalSources.sourceId, '7001'))
    expect(sources).toHaveLength(1)

    const [created] = await db.select().from(accommodations).where(eq(accommodations.id, sources[0].accommodationId))
    const originalSlug = created!.slug

    // Second import: update (same id, same name)
    const filePath2 = writeTmpJson([residence])
    mockGeocoder()

    const result = await command.execute({ file: filePath2 })
    expect(result.updated).toBe(1)

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.id, created!.id))
    expect(updated!.slug).toBe(originalSlug)
  })
})
