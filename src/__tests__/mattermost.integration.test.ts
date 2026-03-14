import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { ownerCaller } from './helpers/test-caller'

vi.mock('~/server/services/mattermost', () => ({
  notifyAccommodationCreated: vi.fn(),
  notifyAccommodationUpdated: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { notifyAccommodationCreated, notifyAccommodationUpdated } = (await import('~/server/services/mattermost')) as {
  notifyAccommodationCreated: ReturnType<typeof vi.fn>
  notifyAccommodationUpdated: ReturnType<typeof vi.fn>
}

type AccommodationOverrides = NonNullable<Parameters<typeof createAccommodation>[0]>
type AccommodationGeom = NonNullable<AccommodationOverrides['geom']>
const parisPoint = { type: 'Point', coordinates: [2.3522, 48.8566] } as AccommodationGeom

beforeEach(async () => {
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  vi.clearAllMocks()
})

describe('mattermost notifications', () => {
  it('notifies on accommodation creation', async () => {
    const result = await ownerCaller.bailleur.create({
      name: 'Résidence Webhook',
      address: '1 rue de la Paix',
      city: 'Paris',
      postal_code: '75001',
      external_url: 'https://example.com',
      typologies: [{ type: 'T1', price_min: 400, price_max: 600, colocation: false, nb_total: 10, nb_available: 5 }],
    })

    expect(notifyAccommodationCreated).toHaveBeenCalledOnce()
    expect(notifyAccommodationCreated).toHaveBeenCalledWith('Résidence Webhook', expect.any(String), result.slug, 'Test Owner')
  })

  it('notifies on accommodation update with diff', async () => {
    const owner = await createOwner({ name: 'Owner Notif', slug: 'owner-notif', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Before Notif',
      slug: 'notif-update',
      ownerId: owner.id,
      geom: parisPoint,
    })

    await ownerCaller.bailleur.update({
      slug: 'notif-update',
      name: 'After Notif',
      description: 'New desc',
    })

    expect(notifyAccommodationUpdated).toHaveBeenCalledOnce()
    const [name, ownerName, slug, userName, diff] = notifyAccommodationUpdated.mock.calls[0]
    expect(name).toBe('After Notif')
    expect(ownerName).toBe('Owner Notif')
    expect(slug).toBe('notif-update')
    expect(userName).toBe('Test Owner')
    expect(diff).toHaveProperty('name')
    expect(diff.name).toEqual({ old: 'Before Notif', new: 'After Notif' })
  })

  it('notifies on availability update with diff', async () => {
    const owner = await createOwner({ name: 'Owner Avail Notif', slug: 'owner-avail-notif', userId: 'test-owner-id' })
    await createAccommodation({
      name: 'Avail Notif',
      slug: 'avail-notif',
      ownerId: owner.id,
      nbT1: 10,
      available: false,
      geom: parisPoint,
    })

    await ownerCaller.bailleur.updateAvailability({
      slug: 'avail-notif',
      nb_t1_available: 5,
      nb_t1_bis_available: null,
      nb_t2_available: null,
      nb_t3_available: null,
      nb_t4_available: null,
      nb_t5_available: null,
      nb_t6_available: null,
      nb_t7_more_available: null,
    })

    expect(notifyAccommodationUpdated).toHaveBeenCalledOnce()
    const [name, ownerName, slug, userName, diff] = notifyAccommodationUpdated.mock.calls[0]
    expect(name).toBe('Avail Notif')
    expect(ownerName).toBe('Owner Avail Notif')
    expect(slug).toBe('avail-notif')
    expect(userName).toBe('Test Owner')
    expect(diff).toHaveProperty('available')
    expect(diff.available).toEqual({ old: false, new: true })
  })
})
