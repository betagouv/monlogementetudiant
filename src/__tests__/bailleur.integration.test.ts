import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import {
  createAcademy,
  createAccommodation,
  createAdminOwnerLink,
  createCity,
  createDepartment,
  createOwner,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, gestionnaireCallerFactory, ownerCaller, ownerCaller2 } from './helpers/test-caller'

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
    expect(result.results).toEqual([])
  })

  it('accepts users with role=admin', async () => {
    const result = await adminCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(0)
    expect(result.results).toEqual([])
  })
})

describe('bailleur.create', () => {
  it('creates a residence for the linked owner and returns slug', async () => {
    await createOwner({ name: 'Owner Create', slug: 'owner-create', userId: 'test-owner-id' })
    const result = await ownerCaller.bailleur.create({
      name: 'Résidence Test',
      addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      typologies: [
        {
          type: 't1',
          priceMin: 400,
          priceMax: 600,
          superficieMin: 15,
          superficieMax: 25,
          colocation: false,
          nbTotal: 10,
          nbAvailable: 5,
        },
      ],
    })

    expect(result.slug).toBeDefined()
    expect(result.slug).toContain('residence-test')
  })

  it('attaches the created residence to the linked owner and lists it', async () => {
    await createCityWithName('Lyon', 'lyon', ['69001'])
    const owner = await createOwner({ name: 'Owner List', slug: 'owner-list', userId: 'test-owner-id' })
    const result = await ownerCaller.bailleur.create({
      name: 'Ma Résidence',
      addresses: [{ address: '2 avenue des Champs', city: 'Lyon', postalCode: '69001' }],
      externalUrl: 'https://example.com',
      typologies: [
        {
          type: 't2',
          priceMin: 500,
          priceMax: 700,
          superficieMin: 25,
          superficieMax: 35,
          colocation: false,
          nbTotal: 5,
          nbAvailable: 3,
        },
      ],
    })

    const db = getTestDb()
    const [created] = await db.select().from(accommodations).where(eq(accommodations.slug, result.slug))
    expect(created.ownerId).toBe(owner.id)

    const list = await ownerCaller.bailleur.list({ page: 1 })
    expect(list.count).toBeGreaterThanOrEqual(1)
  })

  it('rejects owner-role user without a linked account_owner', async () => {
    await expect(
      ownerCaller.bailleur.create({
        name: 'No Owner Residence',
        addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
        externalUrl: 'https://example.com',
        typologies: [
          {
            type: 't1',
            priceMin: 400,
            priceMax: 600,
            superficieMin: 15,
            superficieMax: 25,
            colocation: false,
            nbTotal: 5,
            nbAvailable: 2,
          },
        ],
      }),
    ).rejects.toThrow('No owner record for this user')
  })

  it('attaches the residence to the switched owner when admin passes ownerId', async () => {
    const switched = await createOwner({ name: 'Switched Owner', slug: 'switched-owner' })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: switched.id })

    const result = await adminCaller.bailleur.create({
      name: 'Résidence Admin Switch',
      addresses: [{ address: '3 rue Admin', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      ownerId: switched.id,
      typologies: [
        {
          type: 't1',
          priceMin: 400,
          priceMax: 600,
          superficieMin: 15,
          superficieMax: 25,
          colocation: false,
          nbTotal: 5,
          nbAvailable: 2,
        },
      ],
    })

    const db = getTestDb()
    const [created] = await db.select().from(accommodations).where(eq(accommodations.slug, result.slug))
    expect(created.ownerId).toBe(switched.id)

    // No new account_owner created for the admin
    const adminNamedOwners = await db.select().from(owners).where(eq(owners.name, 'Test Admin'))
    expect(adminNamedOwners).toHaveLength(0)
  })

  it('rejects admin without any linked owner and no ownerId', async () => {
    await expect(
      adminCaller.bailleur.create({
        name: 'Orphan Admin Residence',
        addresses: [{ address: '4 rue Orphan', city: 'Paris', postalCode: '75001' }],
        externalUrl: 'https://example.com',
        typologies: [
          {
            type: 't1',
            priceMin: 400,
            priceMax: 600,
            superficieMin: 15,
            superficieMax: 25,
            colocation: false,
            nbTotal: 5,
            nbAvailable: 2,
          },
        ],
      }),
    ).rejects.toThrow('No owner record for this user')
  })

  it('rejects admin passing ownerId for an owner they are not linked to', async () => {
    const other = await createOwner({ name: 'Other Owner', slug: 'other-owner' })

    await expect(
      adminCaller.bailleur.create({
        name: 'Unauthorized Owner Residence',
        addresses: [{ address: '5 rue Unauth', city: 'Paris', postalCode: '75001' }],
        externalUrl: 'https://example.com',
        ownerId: other.id,
        typologies: [
          {
            type: 't1',
            priceMin: 400,
            priceMax: 600,
            superficieMin: 15,
            superficieMax: 25,
            colocation: false,
            nbTotal: 5,
            nbAvailable: 2,
          },
        ],
      }),
    ).rejects.toThrow('No owner record for this user')
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
    expect(result.results.map((f) => f.name)).toEqual(expect.arrayContaining(['Résidence A', 'Résidence B']))
  })

  it('filters by search term', async () => {
    const owner = await createOwner({ name: 'Owner Search', slug: 'owner-search', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Résidence Soleil', slug: 'soleil', ownerId: owner.id })
    await createAccommodation({ name: 'Résidence Lune', slug: 'lune', ownerId: owner.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Soleil' })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Soleil')
  })

  it('filters by city name', async () => {
    const owner = await createOwner({ name: 'Owner City', slug: 'owner-city', userId: 'test-owner-id' })
    const marseille = await createCityWithName('Marseille', 'marseille')
    const lyon = await createCityWithName('Lyon', 'lyon')
    await createAccommodation({ name: 'Résidence A', slug: 'city-a', ownerId: owner.id, cityId: marseille.id })
    await createAccommodation({ name: 'Résidence B', slug: 'city-b', ownerId: owner.id, cityId: lyon.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'Marseille' })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence A')
  })

  it('filters by partial city name (case insensitive)', async () => {
    const owner = await createOwner({ name: 'Owner Partial', slug: 'owner-partial', userId: 'test-owner-id' })
    const saintEtienne = await createCityWithName('Saint-Étienne', 'saint-etienne')
    await createAccommodation({ name: 'Résidence Stéphanoise', slug: 'partial-city', ownerId: owner.id, cityId: saintEtienne.id })

    const result = await ownerCaller.bailleur.list({ page: 1, search: 'saint-ét' })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Stéphanoise')
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
    const detail = list.results.find((f) => f.slug === 'to-update')
    expect(detail?.name).toBe('After Update')
    expect(detail?.description).toBe('Updated description')
  })

  it('preserves total apartments and price minimum when only images are updated', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Image Update', slug: 'owner-image-update', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Image Update',
      slug: 'image-update',
      ownerId: owner.id,
      nbTotalApartments: 42,
      priceMin: 500,
      imagesUrls: ['https://example.com/old.jpg'],
      geom: parisPoint,
    })

    await ownerCaller.bailleur.update({
      slug: 'image-update',
      imagesUrls: ['https://example.com/old.jpg', 'https://example.com/new.jpg'],
    })

    const [updated] = await db.select().from(accommodations).where(eq(accommodations.slug, 'image-update'))
    expect(updated.nbTotalApartments).toBe(42)
    expect(updated.priceMin).toBe(500)
    expect(updated.imagesUrls).toEqual(['https://example.com/old.jpg', 'https://example.com/new.jpg'])
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
    await createAccommodation(
      {
        name: 'Other Avail Res',
        slug: 'other-avail-update',
        ownerId: otherOwner.id,
        geom: parisPoint,
      },
      [typologyDraft('t1', { nbTotal: 10 })],
    )

    const result = await adminCaller.bailleur.updateAvailability({
      slug: 'other-avail-update',
      availability: [{ type: 't1', nbAvailable: 5 }],
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
    await createAccommodation(
      {
        name: 'Avail Test',
        slug: 'avail-test',
        ownerId: owner.id,
        geom: parisPoint,
      },
      [typologyDraft('t1', { nbTotal: 10 }), typologyDraft('t2', { nbTotal: 5 })],
    )

    const result = await ownerCaller.bailleur.updateAvailability({
      slug: 'avail-test',
      availability: [
        { type: 't1', nbAvailable: 3 },
        { type: 't2', nbAvailable: 2 },
      ],
    })

    expect(result.slug).toBe('avail-test')

    const list = await ownerCaller.bailleur.list({ page: 1 })
    const detail = list.results.find((f) => f.slug === 'avail-test')
    expect(detail?.typologies.t1?.nbAvailable).toBe(3)
    expect(detail?.typologies.t2?.nbAvailable).toBe(2)
  })

  it('preserves null availability when updating with null (does not default to 0)', async () => {
    const owner = await createOwner({ name: 'Owner NullAvail', slug: 'owner-null-avail', userId: 'test-owner-id' })
    await createAccommodation(
      {
        name: 'Null Avail Test',
        slug: 'null-avail-test',
        ownerId: owner.id,
        geom: parisPoint,
      },
      [typologyDraft('t1', { nbTotal: 10 }), typologyDraft('t2', { nbTotal: 5 }), typologyDraft('t3', { nbTotal: null })],
    )

    // Update with explicit nulls for typologies without stock
    await ownerCaller.bailleur.updateAvailability({
      slug: 'null-avail-test',
      availability: [
        { type: 't1', nbAvailable: 3 },
        { type: 't2', nbAvailable: null },
        { type: 't3', nbAvailable: null },
      ],
    })

    const list = await ownerCaller.bailleur.list({ page: 1 })
    const detail = list.results.find((f) => f.slug === 'null-avail-test')

    // t1 was explicitly set to 3
    expect(detail?.typologies.t1?.nbAvailable).toBe(3)
    // t2 exists (nbT2 stock) but was sent as null → should remain null, not become 0
    expect(detail?.typologies.t2).toBeDefined()
    expect(detail?.typologies.t2?.nbAvailable).toBeNull()
    // t3 has no stock → no typology row exists, sending availability does not create one
    expect(detail?.typologies.t3).toBeUndefined()
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
      virtualTourUrl: 'https://tour.example.com',
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
    await createAccommodation(
      {
        name: 'Avail Class',
        slug: 'avail-class',
        ownerId: owner.id,
        geom: parisPoint,
      },
      [typologyDraft('t1', { nbTotal: 10, nbAvailable: 5 })],
    )

    await db.delete(activityLog)
    await ownerCaller.bailleur.updateAvailability({
      slug: 'avail-class',
      availability: [{ type: 't1', nbAvailable: 8 }],
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('accommodation.availability_updated')
  })

  // Les typologies vivent dans une table enfant, hors du périmètre de computeDiff : leur diff est
  // calculé à part. Sans ça, le journal admin n'affiche plus aucun avant/après sur les
  // disponibilités, les surfaces, les loyers ni les compteurs.
  it('records the before/after of an availability change', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Diff Avail', slug: 'owner-diff-avail', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Diff Avail', slug: 'diff-avail', ownerId: owner.id, geom: parisPoint }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 5 }),
      typologyDraft('t3', { nbTotal: 4, nbAvailable: 2 }),
    ])

    await db.delete(activityLog)
    await ownerCaller.bailleur.updateAvailability({
      slug: 'diff-avail',
      availability: [{ type: 't1', nbAvailable: 8 }],
    })

    const [log] = await db.select().from(activityLog)
    const meta = log.metadata as { diff: Record<string, { old: unknown; new: unknown }> }
    expect(meta.diff).toEqual({ 'typologies.t1.nbAvailable': { old: 5, new: 8 } })
  })

  it('records the before/after of surfaces, rents and counts', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Diff Typo', slug: 'owner-diff-typo', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Diff Typo', slug: 'diff-typo', ownerId: owner.id, geom: parisPoint }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 5, priceMin: 400, priceMax: 600, superficieMin: 15, superficieMax: 25 }),
    ])

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'diff-typo',
      typologies: [
        { type: 't1', nbTotal: 12, nbAvailable: 5, priceMin: 400, priceMax: 650, superficieMin: 18, superficieMax: 25, colocation: false },
      ],
    })

    const [log] = await db.select().from(activityLog)
    expect(log.action).toBe('accommodation.updated')
    const meta = log.metadata as { diff: Record<string, { old: unknown; new: unknown }> }
    expect(meta.diff).toEqual({
      'typologies.t1.nbTotal': { old: 10, new: 12 },
      'typologies.t1.priceMax': { old: 600, new: 650 },
      'typologies.t1.superficieMin': { old: 15, new: 18 },
    })
  })

  it('records an added and a removed typology', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Diff Add', slug: 'owner-diff-add', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Diff Add', slug: 'diff-add', ownerId: owner.id, geom: parisPoint }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 5 }),
    ])

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'diff-add',
      typologies: [{ type: 't2', nbTotal: 3, nbAvailable: 1, colocation: false }],
    })

    const [log] = await db.select().from(activityLog)
    const meta = log.metadata as { diff: Record<string, { old: unknown; new: unknown }> }
    expect(meta.diff['typologies.t1.present']).toEqual({ old: true, new: false })
    expect(meta.diff['typologies.t2.present']).toEqual({ old: false, new: true })
    expect(meta.diff['typologies.t2.nbTotal']).toEqual({ old: null, new: 3 })
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

  it('logs published and availability changes as separate log entries', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Split', slug: 'owner-split', userId: 'test-owner-id' })
    await createAccommodation(
      {
        name: 'Split Test',
        slug: 'split-test',
        ownerId: owner.id,
        published: false,
        geom: parisPoint,
      },
      [typologyDraft('t1', { nbTotal: 10, nbAvailable: 0 })],
    )

    await db.delete(activityLog)
    await ownerCaller.bailleur.update({
      slug: 'split-test',
      published: true,
    })
    await ownerCaller.bailleur.updateAvailability({
      slug: 'split-test',
      availability: [{ type: 't1', nbAvailable: 5 }],
    })

    const logs = await db.select().from(activityLog)
    expect(logs).toHaveLength(2)

    const actions = logs.map((l) => l.action).sort()
    expect(actions).toEqual(['accommodation.availability_updated', 'accommodation.published'])

    const pubLog = logs.find((l) => l.action === 'accommodation.published')!
    const pubMeta = pubLog.metadata as { diff: Record<string, unknown> }
    expect(Object.keys(pubMeta.diff)).toEqual(['published'])
  })

  it('logs creation with accommodation.created action', async () => {
    const db = getTestDb()

    await createOwner({ name: 'Owner LogCreate', slug: 'owner-log-create', userId: 'test-owner-id' })
    await db.delete(activityLog)
    await ownerCaller.bailleur.create({
      name: 'Created Residence',
      addresses: [{ address: '10 rue Test', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      typologies: [
        {
          type: 't1',
          priceMin: 400,
          priceMax: 600,
          superficieMin: 15,
          superficieMax: 25,
          colocation: false,
          nbTotal: 5,
          nbAvailable: 3,
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

describe('bailleur.list owner isolation', () => {
  it('owner cannot see residences of another owner', async () => {
    const owner1 = await createOwner({ name: 'Owner Iso 1', slug: 'owner-iso-1', userId: 'test-owner-id' })
    const owner2 = await createOwner({ name: 'Owner Iso 2', slug: 'owner-iso-2', userId: 'test-owner-id-2' })

    await createAccommodation({ name: 'Résidence Owner 1', slug: 'iso-res-1', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence Owner 2', slug: 'iso-res-2', ownerId: owner2.id })

    const result = await ownerCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Owner 1')
  })

  it('owner cannot see residences of another owner by passing bailleur param', async () => {
    const owner1 = await createOwner({ name: 'Owner Hack 1', slug: 'owner-hack-1', userId: 'test-owner-id' })
    const owner2 = await createOwner({ name: 'Owner Hack 2', slug: 'owner-hack-2', userId: 'test-owner-id-2' })

    await createAccommodation({ name: 'Résidence Hack 1', slug: 'hack-res-1', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence Hack 2', slug: 'hack-res-2', ownerId: owner2.id })

    // Owner 1 tries to access Owner 2's residences via bailleur param
    const result = await ownerCaller.bailleur.list({ page: 1, ownerId: owner2.id })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Hack 1')
  })

  it('owner2 cannot see residences of owner1 by passing bailleur param', async () => {
    const owner1 = await createOwner({ name: 'Owner Cross 1', slug: 'owner-cross-1', userId: 'test-owner-id' })
    const owner2 = await createOwner({ name: 'Owner Cross 2', slug: 'owner-cross-2', userId: 'test-owner-id-2' })

    await createAccommodation({ name: 'Résidence Cross 1', slug: 'cross-res-1', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence Cross 2', slug: 'cross-res-2', ownerId: owner2.id })

    // Owner 2 tries to access Owner 1's residences via bailleur param
    const result = await ownerCaller2.bailleur.list({ page: 1, ownerId: owner1.id })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Cross 2')
  })

  it('admin can access residences of a linked owner via bailleur param', async () => {
    const owner1 = await createOwner({ name: 'Admin Linked 1', slug: 'admin-linked-1' })
    const owner2 = await createOwner({ name: 'Admin Linked 2', slug: 'admin-linked-2' })

    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner1.id })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner2.id })

    await createAccommodation({ name: 'Résidence Admin 1', slug: 'admin-res-1', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence Admin 2', slug: 'admin-res-2', ownerId: owner2.id })

    // Admin switches to owner2
    const result = await adminCaller.bailleur.list({ page: 1, ownerId: owner2.id })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Admin 2')
  })

  it('admin without bailleur param sees first linked owner residences', async () => {
    const owner1 = await createOwner({ name: 'Admin Default 1', slug: 'admin-default-1' })
    const owner2 = await createOwner({ name: 'Admin Default 2', slug: 'admin-default-2' })

    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner1.id })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner2.id })

    await createAccommodation({ name: 'Résidence Default 1', slug: 'default-res-1', ownerId: owner1.id })
    await createAccommodation({ name: 'Résidence Default 2', slug: 'default-res-2', ownerId: owner2.id })

    const result = await adminCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(1)
  })

  it('admin cannot access residences of an owner they are not linked to', async () => {
    const linkedOwner = await createOwner({ name: 'Admin Ok', slug: 'admin-ok' })
    const unlinkedOwner = await createOwner({ name: 'Admin Nope', slug: 'admin-nope' })

    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: linkedOwner.id })
    // No link for unlinkedOwner

    await createAccommodation({ name: 'Résidence Linked', slug: 'linked-res', ownerId: linkedOwner.id })
    await createAccommodation({ name: 'Résidence Unlinked', slug: 'unlinked-res', ownerId: unlinkedOwner.id })

    // Admin tries to access unlinked owner via bailleur param — should fallback to linked owner
    const result = await adminCaller.bailleur.list({ page: 1, ownerId: unlinkedOwner.id })
    expect(result.count).toBe(1)
    expect(result.results[0].name).toBe('Résidence Linked')
  })
})

describe('bailleur.setContactMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a gestionnaire without the manage_applications permission', async () => {
    await createUser({ id: 'test-gestionnaire-id', name: 'Gestionnaire', email: 'gestionnaire@test.com', role: 'owner' })
    await createOwner({ name: 'Owner NoPerm', slug: 'owner-no-perm', userId: 'test-gestionnaire-id' })

    const noPermCaller = gestionnaireCallerFactory()
    await expect(noPermCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })).rejects.toThrow(
      'Administrateur du bailleur requis',
    )
  })

  it('rejects a gestionnaire even holding manage_applications: the mode applies to the whole owner', async () => {
    await createUser({ id: 'test-gestionnaire-id', name: 'Gestionnaire', email: 'gestionnaire@test.com', role: 'owner' })
    const owner = await createOwner({ name: 'Owner Perm', slug: 'owner-perm', userId: 'test-gestionnaire-id' })

    const permCaller = gestionnaireCallerFactory({ permissions: ['manage_applications'] })
    await expect(permCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })).rejects.toThrow(
      'Administrateur du bailleur requis',
    )

    const db = getTestDb()
    const unchanged = await db.query.owners.findFirst({ where: eq(owners.id, owner.id) })
    expect(unchanged!.contactMode).toBe(owner.contactMode)
  })

  it('accepts an owner administrator', async () => {
    await createOwner({ name: 'Owner Admin Mode', slug: 'owner-admin-mode', userId: 'test-owner-id' })

    const result = await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })
    expect(result.contactMode).toBe('contacts')
  })

  it('allows dossier_facile outside production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development')
    await createOwner({ name: 'Owner DF Dev', slug: 'owner-df-dev', userId: 'test-owner-id' })

    const result = await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.DOSSIER_FACILE })
    expect(result.contactMode).toBe('dossier_facile')
  })

  it('rejects dossier_facile in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
    const owner = await createOwner({ name: 'Owner DF Prod', slug: 'owner-df-prod', userId: 'test-owner-id' })

    await expect(ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.DOSSIER_FACILE })).rejects.toThrow(
      'DossierFacile is not available yet',
    )

    // Les autres modes restent activables.
    await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })
    const db = getTestDb()
    const updated = await db.query.owners.findFirst({ where: eq(owners.id, owner.id) })
    expect(updated!.contactMode).toBe('contacts')
  })
})
