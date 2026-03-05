import { beforeEach, describe, expect, it } from 'vitest'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { adminCaller, authenticatedCaller, caller, ownerCaller } from './helpers/test-caller'
import './helpers/setup-integration'

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

  it('filters by availability', async () => {
    const owner = await createOwner({ name: 'Owner Filter', slug: 'owner-filter', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Available', slug: 'available', ownerId: owner.id, available: true })
    await createAccommodation({ name: 'Unavailable', slug: 'unavailable', ownerId: owner.id, available: false })

    const availableResult = await ownerCaller.bailleur.list({ page: 1, hasAvailability: true })
    expect(availableResult.count).toBe(1)
    expect(availableResult.results.features[0].properties.name).toBe('Available')

    const unavailableResult = await ownerCaller.bailleur.list({ page: 1, hasAvailability: false })
    expect(unavailableResult.count).toBe(1)
    expect(unavailableResult.results.features[0].properties.name).toBe('Unavailable')
  })

  it('filters by search term', async () => {
    const owner = await createOwner({ name: 'Owner Search', slug: 'owner-search', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Résidence Soleil', slug: 'soleil', ownerId: owner.id })
    await createAccommodation({ name: 'Résidence Lune', slug: 'lune', ownerId: owner.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Soleil' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.name).toBe('Résidence Soleil')
  })
})

describe('bailleur.getBySlug', () => {
  it('returns accommodation details with amenities', async () => {
    const owner = await createOwner({ name: 'Owner Detail', slug: 'owner-detail', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Résidence Détail',
      slug: 'residence-detail',
      ownerId: owner.id,
      laundryRoom: true,
      wifi: true,
      parking: false,
      geom: { type: 'Point', coordinates: [2.3522, 48.8566] },
    })

    const result = await ownerCaller.bailleur.getBySlug({ slug: 'residence-detail' })
    expect(result.properties.name).toBe('Résidence Détail')
    expect(result.properties.laundry_room).toBe(true)
    expect(result.properties.wifi).toBe(true)
    expect(result.properties.parking).toBe(false)
    expect(result.geometry.type).toBe('Point')
  })

  it('rejects access to accommodation owned by another user', async () => {
    const otherOwner = await createOwner({ name: 'Other Owner', slug: 'other-owner', userId: 'test-owner-id-2' })
    await createAccommodation({ name: 'Not Mine', slug: 'not-mine', ownerId: otherOwner.id })

    await expect(ownerCaller.bailleur.getBySlug({ slug: 'not-mine' })).rejects.toThrow('Accommodation not found')
  })
})

describe('bailleur.update', () => {
  it('updates accommodation details', async () => {
    const owner = await createOwner({ name: 'Owner Update', slug: 'owner-update', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Before Update',
      slug: 'to-update',
      ownerId: owner.id,
      geom: { type: 'Point', coordinates: [2.3522, 48.8566] },
    })

    const result = await ownerCaller.bailleur.update({
      slug: 'to-update',
      name: 'After Update',
      description: 'Updated description',
    })

    expect(result.slug).toBe('to-update')

    const detail = await ownerCaller.bailleur.getBySlug({ slug: 'to-update' })
    expect(detail.properties.name).toBe('After Update')
    expect(detail.properties.description).toBe('Updated description')
  })

  it('rejects update of accommodation owned by another user', async () => {
    const otherOwner = await createOwner({ name: 'Other Update', slug: 'other-update', userId: 'test-owner-id-2' })
    await createAccommodation({ name: 'Not Mine', slug: 'not-mine-update', ownerId: otherOwner.id })

    await expect(ownerCaller.bailleur.update({ slug: 'not-mine-update', name: 'Hacked' })).rejects.toThrow()
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
      geom: { type: 'Point', coordinates: [2.3522, 48.8566] },
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

    const detail = await ownerCaller.bailleur.getBySlug({ slug: 'avail-test' })
    expect(detail.properties.nb_t1_available).toBe(3)
    expect(detail.properties.nb_t2_available).toBe(2)
    expect(detail.properties.available).toBe(true)
  })
})
