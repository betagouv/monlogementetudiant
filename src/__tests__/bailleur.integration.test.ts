import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activityLog } from '../server/db/schema/activity-log'
import { createAcademy, createAccommodation, createCity, createDepartment, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, ownerCaller } from './helpers/test-caller'

type AccommodationOverrides = NonNullable<Parameters<typeof createAccommodation>[0]>
type AccommodationGeom = NonNullable<AccommodationOverrides['geom']>
const parisPoint = { type: 'Point', coordinates: [2.3522, 48.8566] } as AccommodationGeom

let cityHelperCounter = 0
async function createCityWithName(name: string, slug: string, postalCodes: string[] = ['00000']) {
  const suffix = ++cityHelperCounter
  const academy = await createAcademy({ name: `Académie ${name}` })
  const department = await createDepartment({ academyId: academy.id, name: `Département ${name}`, code: String(90 + suffix) })
  return createCity({ departmentId: department.id, name, slug, postalCodes })
}

// Create user records before each test
beforeEach(async () => {
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Test Owner 2', email: 'owner2@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

describe('ownerProcedure authorization', () => {
  it('rejects unauthenticated users', async () => {
    await expect(caller.bailleur.list({ page: 1 })).rejects.toThrow('UNAUTHORIZED')
  })

  it('rejects users with role=user (FORBIDDEN)', async () => {
    await expect(authenticatedCaller.bailleur.list({ page: 1 })).rejects.toThrow('Owner or admin role required')
  })

  it('accepts users with role=owner', async () => {
    const result = await ownerCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(0)
    expect(result.results.features).toEqual([])
  })

  it('accepts users with role=admin', async () => {
    const result = await adminCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(0)
    expect(result.results.features).toEqual([])
  })
})

describe('bailleur.create', () => {
  it('creates a residence and returns slug', async () => {
    const result = await ownerCaller.bailleur.create({
      name: 'Résidence Test',
      address: '1 rue de la Paix',
      city: 'Paris',
      postal_code: '75001',
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
    expect(result.slug).toContain('residence-test')
  })

  it('creates owner record automatically and lists it', async () => {
    await createCityWithName('Lyon', 'lyon', ['69001'])
    await ownerCaller.bailleur.create({
      name: 'Ma Résidence',
      address: '2 avenue des Champs',
      city: 'Lyon',
      postal_code: '69001',
      external_url: 'https://example.com',
      typologies: [
        {
          type: 'T2',
          price_min: 500,
          price_max: 700,
          superficie_min: 25,
          superficie_max: 35,
          colocation: false,
          nb_total: 5,
          nb_available: 3,
        },
      ],
    })

    const list = await ownerCaller.bailleur.list({ page: 1 })
    expect(list.count).toBeGreaterThanOrEqual(1)
  })
})

describe('bailleur.list', () => {
  it('returns only accommodations owned by the current user', async () => {
    const owner1 = await createOwner({ name: 'Owner 1', slug: 'owner-1', userId: 'test-owner-id' })
    const owner2 = await createOwner({ name: 'Owner 2', slug: 'owner-2', userId: 'test-owner-id-2' })

    await createAccommodation({ name: 'Résidence A', slug: 'residence-a', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence B', slug: 'residence-b', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence C', slug: 'residence-c', ownerId: owner2.id })

    const result = await ownerCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(2)
    expect(result.results.features.map((f) => f.properties.name)).toEqual(expect.arrayContaining(['Résidence A', 'Résidence B']))
  })

  it('filters by search term', async () => {
    const owner = await createOwner({ name: 'Owner Search', slug: 'owner-search', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Résidence Soleil', slug: 'soleil', ownerId: owner.id })
    await createAccommodation({ name: 'Résidence Lune', slug: 'lune', ownerId: owner.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Soleil' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.name).toBe('Résidence Soleil')
  })

  it('filters by city name', async () => {
    const owner = await createOwner({ name: 'Owner City', slug: 'owner-city', userId: 'test-owner-id' })
    const marseille = await createCityWithName('Marseille', 'marseille')
    const lyon = await createCityWithName('Lyon', 'lyon')
    await createAccommodation({ name: 'Résidence A', slug: 'city-a', ownerId: owner.id, cityId: marseille.id })
    await createAccommodation({ name: 'Résidence B', slug: 'city-b', ownerId: owner.id, cityId: lyon.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Marseille' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.name).toBe('Résidence A')
  })

  it('filters by partial city name (case insensitive)', async () => {
    const owner = await createOwner({ name: 'Owner Partial', slug: 'owner-partial', userId: 'test-owner-id' })
    const saintEtienne = await createCityWithName('Saint-Étienne', 'saint-etienne')
    await createAccommodation({ name: 'Résidence Stéphanoise', slug: 'partial-city', ownerId: owner.id, cityId: saintEtienne.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'saint-ét' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.name).toBe('Résidence Stéphanoise')
  })

  it('filters by city or name', async () => {
    const owner = await createOwner({ name: 'Owner CityOrName', slug: 'owner-city-or-name', userId: 'test-owner-id' })
    const bordeaux = await createCityWithName('Bordeaux', 'bordeaux')
    await createAccommodation({ name: 'Résidence Lumière', slug: 'city-or-name-a', ownerId: owner.id, cityId: bordeaux.id })
    await createAccommodation({ name: 'Résidence Bordeaux', slug: 'city-or-name-b', ownerId: owner.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Bordeaux' })
    expect(result.count).toBe(2)
  })
})

describe('bailleur.update', () => {
  it('updates accommodation details', async () => {
    const owner = await createOwner({ name: 'Owner Update', slug: 'owner-update', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Before Update',
      slug: 'to-update',
      ownerId: owner.id,
      geom: parisPoint,
    })

    const result = await ownerCaller.bailleur.update({
      slug: 'to-update',
      name: 'After Update',
      description: 'Updated description',
    })

    expect(result.slug).toBe('to-update')

    const list = await ownerCaller.bailleur.list({ page: 1 })
    const detail = list.results.features.find((f) => f.properties.slug === 'to-update')
    expect(detail?.properties.name).toBe('After Update')
    expect(detail?.properties.description).toBe('Updated description')
  })

  it('rejects update of accommodation owned by another user', async () => {
    const otherOwner = await createOwner({ name: 'Other Update', slug: 'other-update', userId: 'test-owner-id-2' })
    await createAccommodation({ name: 'Not Mine', slug: 'not-mine-update', ownerId: otherOwner.id })

    await expect(ownerCaller.bailleur.update({ slug: 'not-mine-update', name: 'Hacked' })).rejects.toThrow()
  })
})

describe('admin verifyOwnership bypass', () => {
  it('admin can update accommodation owned by another user', async () => {
    const otherOwner = await createOwner({ name: 'Other Admin', slug: 'other-admin', userId: 'test-owner-id-2' })
    await createAccommodation({
      name: 'Other Residence',
      slug: 'other-admin-update',
      ownerId: otherOwner.id,
      geom: parisPoint,
    })

    const result = await adminCaller.bailleur.update({
      slug: 'other-admin-update',
      name: 'Admin Updated',
    })

    expect(result.slug).toBe('other-admin-update')
  })

  it('admin can updateAvailability on accommodation owned by another user', async () => {
    const otherOwner = await createOwner({ name: 'Other Avail', slug: 'other-avail', userId: 'test-owner-id-2' })
    await createAccommodation({
      name: 'Other Avail Res',
      slug: 'other-avail-update',
      ownerId: otherOwner.id,
      nbT1: 10,
      available: false,
      geom: parisPoint,
    })

    const result = await adminCaller.bailleur.updateAvailability({
      slug: 'other-avail-update',
      nb_t1_available: 5,
      nb_t1_bis_available: null,
      nb_t2_available: null,
      nb_t3_available: null,
      nb_t4_available: null,
      nb_t5_available: null,
      nb_t6_available: null,
      nb_t7_more_available: null,
    })

    expect(result.slug).toBe('other-avail-update')
  })

  it('admin gets NOT_FOUND for nonexistent accommodation', async () => {
    await expect(adminCaller.bailleur.update({ slug: 'nonexistent', name: 'Nope' })).rejects.toThrow('Accommodation not found')
  })

  it('owner still cannot update accommodation owned by another user', async () => {
    await createOwner({ name: 'My Owner', slug: 'my-owner', userId: 'test-owner-id' })
    const otherOwner = await createOwner({ name: 'Still Other', slug: 'still-other', userId: 'test-owner-id-2' })
    await createAccommodation({ name: 'Still Not Mine', slug: 'still-not-mine', ownerId: otherOwner.id })

    await expect(ownerCaller.bailleur.update({ slug: 'still-not-mine', name: 'Hacked' })).rejects.toThrow(
      'Accommodation not found or not owned by you',
    )
  })
})

describe('bailleur.updateAvailability', () => {
  it('updates availability fields', async () => {
    const owner = await createOwner({ name: 'Owner Avail', slug: 'owner-avail', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Avail Test',
      slug: 'avail-test',
      ownerId: owner.id,
      nbT1: 10,
      nbT2: 5,
      available: false,
      geom: parisPoint,
    })

    const result = await ownerCaller.bailleur.updateAvailability({
      slug: 'avail-test',
      nb_t1_available: 3,
      nb_t1_bis_available: null,
      nb_t2_available: 2,
      nb_t3_available: null,
      nb_t4_available: null,
      nb_t5_available: null,
      nb_t6_available: null,
      nb_t7_more_available: null,
    })

    expect(result.slug).toBe('avail-test')

    const list = await ownerCaller.bailleur.list({ page: 1 })
    const detail = list.results.features.find((f) => f.properties.slug === 'avail-test')
    expect(detail?.properties.nb_t1_available).toBe(3)
    expect(detail?.properties.nb_t2_available).toBe(2)
  })
})

describe('activity_log diff accuracy', () => {
  it('logs only the single field that changed', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Diff', slug: 'owner-diff', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Diff Test',
      slug: 'diff-test',
      ownerId: owner.id,
      description: 'Original description',
      externalUrl: 'https://original.com',
      virtualTourUrl: null,
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'diff-test',
      virtual_tour_url: 'https://tour.example.com',
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.updated')

    const meta = logs[0].metadata as { diff: Record<string, unknown> }
    expect(Object.keys(meta.diff)).toEqual(['virtualTourUrl'])
  })

  it('logs multiple changed fields in a single update', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Multi', slug: 'owner-multi', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Multi Test',
      slug: 'multi-test',
      ownerId: owner.id,
      description: 'Old desc',
      externalUrl: 'https://old.com',
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'multi-test',
      name: 'Multi Updated',
      description: 'New desc',
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.updated')

    const meta = logs[0].metadata as { diff: Record<string, unknown> }
    expect(Object.keys(meta.diff).sort()).toEqual(['description', 'name'])
  })

  it('classifies availability-only changes as accommodation.availability_updated', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Avail2', slug: 'owner-avail2', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Avail Class',
      slug: 'avail-class',
      ownerId: owner.id,
      nbT1: 10,
      nbT1Available: 5,
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'avail-class',
      nb_t1_available: 8,
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.availability_updated')

    const meta = logs[0].metadata as { diff: Record<string, unknown> }
    expect(Object.keys(meta.diff)).toEqual(['nbT1Available'])
  })

  it('classifies published change as accommodation.published', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Pub', slug: 'owner-pub', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Pub Test',
      slug: 'pub-test',
      ownerId: owner.id,
      published: false,
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'pub-test',
      published: true,
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.published')
  })

  it('classifies unpublish change as accommodation.unpublished', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Unpub', slug: 'owner-unpub', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Unpub Test',
      slug: 'unpub-test',
      ownerId: owner.id,
      published: true,
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'unpub-test',
      published: false,
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.unpublished')
  })

  it('splits published + availability into separate log entries', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Split', slug: 'owner-split', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Split Test',
      slug: 'split-test',
      ownerId: owner.id,
      published: false,
      nbT1: 10,
      nbT1Available: 0,
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'split-test',
      published: true,
      nb_t1_available: 5,
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(2)

    const actions = logs.map((l) => l.action).sort()
    expect(actions).toEqual(['accommodation.availability_updated', 'accommodation.published'])

    const pubLog = logs.find((l) => l.action === 'accommodation.published')!
    const pubMeta = pubLog.metadata as { diff: Record<string, unknown> }
    expect(Object.keys(pubMeta.diff)).toEqual(['published'])

    const availLog = logs.find((l) => l.action === 'accommodation.availability_updated')!
    const availMeta = availLog.metadata as { diff: Record<string, unknown> }
    expect(Object.keys(availMeta.diff)).toEqual(['nbT1Available'])
  })

  it('logs creation with accommodation.created action', async () => {
    const db = getTestDb()

    await db.delete(activityLog)
    await ownerCaller.bailleur.create({
      name: 'Created Residence',
      address: '10 rue Test',
      city: 'Paris',
      postal_code: '75001',
      external_url: 'https://example.com',
      typologies: [
        {
          type: 'T1',
          price_min: 400,
          price_max: 600,
          superficie_min: 15,
          superficie_max: 25,
          colocation: false,
          nb_total: 5,
          nb_available: 3,
        },
      ],
    })

    const logs = await db.select().from(activityLog).where(eq(activityLog.action, 'accommodation.created'))
    expect(logs).toHaveLength(1)
    expect(logs[0].entityName).toBe('Created Residence')
    expect(logs[0].ownerName).toBeTruthy()
  })

  it('does not log when no fields actually changed', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner NoChange', slug: 'owner-nochange', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'No Change',
      slug: 'no-change',
      ownerId: owner.id,
      description: 'Same description',
      geom: parisPoint,
    })

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'no-change',
      description: 'Same description',
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(0)
  })
})
