import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accommodationAddresses } from '../server/db/schema/accommodation-addresses'
import { accommodations } from '../server/db/schema/accommodations'
import {
  addAccommodationAddress,
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createOwner,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { caller, ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

let cityHelperCounter = 0
async function createCityWithGeom(name: string, slug: string, postalCodes: string[], boundary: number[][][][]) {
  const suffix = ++cityHelperCounter
  const academy = await createAcademy({ name: `Académie MA ${name} ${suffix}` })
  const department = await createDepartment({ academyId: academy.id, name: `Dept MA ${name} ${suffix}`, code: String(50 + suffix) })
  return createCity({
    departmentId: department.id,
    name,
    slug: `${slug}-${suffix}`,
    postalCodes,
    boundary: { type: 'MultiPolygon', coordinates: boundary },
  })
}

// Simple square boundary helper (approx 0.1 degree around center)
function squareBoundary(lng: number, lat: number): number[][][][] {
  const d = 0.05
  return [
    [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  ]
}

beforeEach(async () => {
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

describe('multi-address: factory & DB', () => {
  it('createAccommodation creates a main address', async () => {
    const db = getTestDb()
    const acc = await createAccommodation({
      slug: 'factory-main-addr',
      address: '10 rue Test',
      postalCode: '75001',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))

    expect(addresses).toHaveLength(1)
    expect(addresses[0].isMain).toBe(true)
    expect(addresses[0].address).toBe('10 rue Test')
    expect(addresses[0].postalCode).toBe('75001')
  })

  it('addAccommodationAddress creates a secondary address', async () => {
    const db = getTestDb()
    const acc = await createAccommodation({
      slug: 'factory-secondary-addr',
      address: '1 rue Principale',
      postalCode: '75001',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const city2 = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))
    await addAccommodationAddress(acc.id, {
      address: '5 rue Secondaire',
      postalCode: '69001',
      cityId: city2.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    const addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))

    expect(addresses).toHaveLength(2)
    expect(addresses.filter((a) => a.isMain)).toHaveLength(1)
    expect(addresses.find((a) => !a.isMain)?.address).toBe('5 rue Secondaire')
  })
})

describe('multi-address: accommodations.getBySlug', () => {
  it('returns all addresses with main address as top-level fields', async () => {
    const paris = await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))
    const lyon = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))

    const acc = await createAccommodation({
      slug: 'multi-addr-detail',
      name: 'Residence Multi',
      address: '10 rue de Paris',
      postalCode: '75001',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await addAccommodationAddress(acc.id, {
      address: '5 avenue de Lyon',
      postalCode: '69001',
      cityId: lyon.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    const result = await caller.accommodations.getBySlug({ slug: 'multi-addr-detail' })

    // Top-level fields come from the main address
    expect(result.address).toBe('10 rue de Paris')
    expect(result.postal_code).toBe('75001')
    expect(result.city).toContain('Paris')

    // All addresses are returned
    expect(result.addresses).toHaveLength(2)
    expect(result.addresses![0].is_main).toBe(true)
    expect(result.addresses![0].address).toBe('10 rue de Paris')
    expect(result.addresses![1].is_main).toBe(false)
    expect(result.addresses![1].address).toBe('5 avenue de Lyon')
  })
})

describe('multi-address: accommodations.list spatial search', () => {
  it('finds accommodation via secondary address in a different city', async () => {
    const paris = await createCityWithGeom('Paris', 'paris', ['75019'], squareBoundary(2.35, 48.85))
    const lyon = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))

    const acc = await createAccommodation({
      slug: 'multi-city-search',
      name: 'Residence Bicephale',
      address: '11 avenue Paris',
      postalCode: '75019',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await addAccommodationAddress(acc.id, {
      address: '23 rue Lyon',
      postalCode: '69001',
      cityId: lyon.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    // Search in Paris - should find it
    const parisResults = await caller.accommodations.list({ cityId: paris.id })
    expect(parisResults.count).toBe(1)
    expect(parisResults.results.features[0].properties.slug).toBe('multi-city-search')

    // Search in Lyon - should also find it via the secondary address
    const lyonResults = await caller.accommodations.list({ cityId: lyon.id })
    expect(lyonResults.count).toBe(1)
    expect(lyonResults.results.features[0].properties.slug).toBe('multi-city-search')
  })

  it('shows contextual city badge based on search city', async () => {
    const paris = await createCityWithGeom('Paris', 'paris', ['75019'], squareBoundary(2.35, 48.85))
    const lyon = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))

    const acc = await createAccommodation({
      slug: 'contextual-badge',
      name: 'Residence Badge',
      address: '1 rue de Paris',
      postalCode: '75019',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await addAccommodationAddress(acc.id, {
      address: '2 rue de Lyon',
      postalCode: '69001',
      cityId: lyon.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    // Search in Lyon -> city badge should show Lyon
    const lyonResults = await caller.accommodations.list({ cityId: lyon.id })
    const feature = lyonResults.results.features[0]
    expect(feature.properties.city).toContain('Lyon')
    expect(feature.properties.postal_code).toBe('69001')
  })

  it('deduplicates when both addresses match the same search', async () => {
    const paris = await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))

    const acc = await createAccommodation({
      slug: 'dedup-test',
      name: 'Residence Dedup',
      address: '1 rue A',
      postalCode: '75001',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    // Second address also in Paris
    await addAccommodationAddress(acc.id, {
      address: '2 rue B',
      postalCode: '75001',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.36, 48.86] },
    })

    const results = await caller.accommodations.list({ cityId: paris.id })
    // Should appear only once, not twice
    expect(results.count).toBe(1)
    expect(results.results.features).toHaveLength(1)
  })

  it('finds accommodation via bbox covering secondary address', async () => {
    const paris = await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))
    const lyon = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))

    const acc = await createAccommodation({
      slug: 'bbox-secondary',
      name: 'Residence BBox',
      address: '1 rue Paris',
      postalCode: '75001',
      cityId: paris.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await addAccommodationAddress(acc.id, {
      address: '1 rue Lyon',
      postalCode: '69001',
      cityId: lyon.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    // BBox around Lyon only
    const results = await caller.accommodations.list({ bbox: '4.7,45.7,4.9,45.9' })
    expect(results.count).toBe(1)
    expect(results.results.features[0].properties.slug).toBe('bbox-secondary')
  })
})

describe('multi-address: bailleur.create with multiple addresses', () => {
  it('creates a residence with multiple addresses', async () => {
    const db = getTestDb()
    await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))
    await createOwner({ name: 'Owner Multi Create', slug: 'owner-multi-create', userId: 'test-owner-id' })

    const result = await ownerCaller.bailleur.create({
      name: 'Residence Multi Create',
      addresses: [
        { address: '1 rue A', city: 'Paris', postal_code: '75001' },
        { address: '2 rue B', city: 'Paris', postal_code: '75001' },
      ],
      external_url: 'https://example.com',
      typologies: [
        {
          type: 'T1',
          price_min: 400,
          price_max: 600,
          superficie_min: 15,
          superficie_max: 25,
          colocation: false,
          nb_total: 10,
          nb_available: 5,
        },
      ],
    })

    expect(result.slug).toBeDefined()

    // Verify addresses in DB
    const [accommodation] = await db.select({ id: accommodations.id }).from(accommodations).where(eq(accommodations.slug, result.slug))
    const addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodation.id))

    expect(addresses).toHaveLength(2)
    expect(addresses.filter((a) => a.isMain)).toHaveLength(1)
    expect(addresses.find((a) => a.isMain)?.address).toBe('1 rue A')
    expect(addresses.find((a) => !a.isMain)?.address).toBe('2 rue B')
  })

  it('rejects creation with zero addresses', async () => {
    await expect(
      ownerCaller.bailleur.create({
        name: 'Residence No Addr',
        addresses: [],
        external_url: 'https://example.com',
        typologies: [
          {
            type: 'T1',
            price_min: 400,
            price_max: 600,
            superficie_min: 15,
            superficie_max: 25,
            colocation: false,
            nb_total: 10,
            nb_available: 5,
          },
        ],
      }),
    ).rejects.toThrow()
  })
})

describe('multi-address: bailleur.update addresses', () => {
  it('replaces all addresses on update', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Upd Addr', slug: 'owner-upd-addr', userId: 'test-owner-id' })
    const paris = await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))

    const acc = await createAccommodation({
      slug: 'update-addresses',
      name: 'Residence Update Addr',
      address: '1 old address',
      postalCode: '75001',
      cityId: paris.id,
      ownerId: owner.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    // Verify initial state
    let addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))
    expect(addresses).toHaveLength(1)

    // Update with 2 new addresses
    await ownerCaller.bailleur.update({
      slug: 'update-addresses',
      addresses: [
        { address: '10 new main', city: 'Paris', postal_code: '75001' },
        { address: '20 new secondary', city: 'Paris', postal_code: '75001' },
      ],
    })

    addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))

    expect(addresses).toHaveLength(2)
    expect(addresses.find((a) => a.isMain)?.address).toBe('10 new main')
    expect(addresses.find((a) => !a.isMain)?.address).toBe('20 new secondary')
  })

  it('can reduce to single address', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Reduce', slug: 'owner-reduce', userId: 'test-owner-id' })
    const paris = await createCityWithGeom('Paris', 'paris', ['75001'], squareBoundary(2.35, 48.85))
    const lyon = await createCityWithGeom('Lyon', 'lyon', ['69001'], squareBoundary(4.83, 45.76))

    const acc = await createAccommodation({
      slug: 'reduce-addresses',
      name: 'Residence Reduce',
      address: '1 rue Paris',
      postalCode: '75001',
      cityId: paris.id,
      ownerId: owner.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await addAccommodationAddress(acc.id, {
      address: '2 rue Lyon',
      postalCode: '69001',
      cityId: lyon.id,
      geom: { type: 'Point', coordinates: [4.83, 45.76] },
    })

    // Update with only 1 address
    await ownerCaller.bailleur.update({
      slug: 'reduce-addresses',
      addresses: [{ address: '99 only address', city: 'Paris', postal_code: '75001' }],
    })

    const addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))

    expect(addresses).toHaveLength(1)
    expect(addresses[0].isMain).toBe(true)
    expect(addresses[0].address).toBe('99 only address')
  })

  it('does not touch addresses when addresses field is omitted', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner NoTouch', slug: 'owner-notouch', userId: 'test-owner-id' })

    const acc = await createAccommodation({
      slug: 'notouch-addresses',
      name: 'Residence NoTouch',
      address: 'original address',
      postalCode: '75001',
      ownerId: owner.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    // Update only name, no addresses field
    await ownerCaller.bailleur.update({
      slug: 'notouch-addresses',
      name: 'New Name',
    })

    const addresses = await db.select().from(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, acc.id))

    expect(addresses).toHaveLength(1)
    expect(addresses[0].address).toBe('original address')
  })
})
