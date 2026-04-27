import { TRPCError } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import {
  createAcademy,
  createAccommodation,
  createAlert,
  createCity,
  createDepartment,
  createFavoriteAccommodation,
  createOwner,
  createTrackingEvent,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { ownerCaller, ownerCaller2 } from './helpers/test-caller'

const OWNER_USER_ID = 'test-owner-id'
const OWNER_USER_ID_2 = 'test-owner-id-2'

async function createCityWithDeps(name: string, slug: string) {
  const academy = await createAcademy({ name: `Academy ${slug}` })
  const department = await createDepartment({ name: `Dept ${slug}`, academyId: academy.id })
  return createCity({ name, slug, departmentId: department.id })
}

async function setupOwnerWithAccommodation() {
  const ownerUser = await createUser({ id: OWNER_USER_ID, role: 'owner' })
  const owner = await createOwner({ name: 'Owner A', slug: 'owner-a', userId: ownerUser.id })
  const city = await createCityWithDeps('Lyon', 'lyon')
  const accommodation = await createAccommodation({
    slug: 'res-a',
    name: 'Résidence A',
    ownerId: owner.id,
    cityId: city.id,
  })
  return { owner, city, accommodation }
}

describe('ownerStatistics.overview', () => {
  it('returns zeros when the owner has no activity', async () => {
    await setupOwnerWithAccommodation()

    const result = await ownerCaller.ownerStatistics.overview({ period: '30d' })

    expect(result.nbSearchesCity).toBe(0)
    expect(result.nbSearchesDepartment).toBe(0)
    expect(result.nbAlerts).toBe(0)
    expect(result.nbFavorites).toBe(0)
    expect(result.nbViews).toBe(0)
    expect(result.nbConsultOffer).toBe(0)
  })

  it('counts views, consult-offer and favorites for accommodations of this owner only', async () => {
    const { owner, accommodation } = await setupOwnerWithAccommodation()

    // Other owner with own accommodation – must not leak
    const otherUser = await createUser({ id: OWNER_USER_ID_2, role: 'owner' })
    const otherOwner = await createOwner({ name: 'Owner B', slug: 'owner-b', userId: otherUser.id })
    const otherCity = await createCityWithDeps('Paris', 'paris')
    const otherAccommodation = await createAccommodation({
      slug: 'res-b',
      name: 'Résidence B',
      ownerId: otherOwner.id,
      cityId: otherCity.id,
    })

    // Views & consult-offer for owner A
    await createTrackingEvent({ type: 'accommodation.viewed', ownerId: owner.id, accommodationId: accommodation.id })
    await createTrackingEvent({ type: 'accommodation.viewed', ownerId: owner.id, accommodationId: accommodation.id })
    await createTrackingEvent({ type: 'accommodation.consult_offer', ownerId: owner.id, accommodationId: accommodation.id })
    // Noise from owner B
    await createTrackingEvent({ type: 'accommodation.viewed', ownerId: otherOwner.id, accommodationId: otherAccommodation.id })
    await createTrackingEvent({ type: 'accommodation.consult_offer', ownerId: otherOwner.id, accommodationId: otherAccommodation.id })

    // Favorites for owner A's accommodation
    const favoriter = await createUser({ id: 'favoriter-1' })
    await createFavoriteAccommodation({ userId: favoriter.id, accommodationId: accommodation.id })
    // Noise: favorite on owner B's accommodation
    await createFavoriteAccommodation({ userId: favoriter.id, accommodationId: otherAccommodation.id })

    const result = await ownerCaller.ownerStatistics.overview({ period: '30d' })

    expect(result.nbViews).toBe(2)
    expect(result.nbConsultOffer).toBe(1)
    expect(result.nbFavorites).toBe(1)
  })

  it('counts searches and alerts on the owner territories', async () => {
    const { owner, city } = await setupOwnerWithAccommodation()

    await createTrackingEvent({ type: 'search.city', cityId: city.id })
    await createTrackingEvent({ type: 'search.city', cityId: city.id })
    await createTrackingEvent({ type: 'search.department', departmentId: city.departmentId })
    // Noise: search on a foreign city
    const foreignCity = await createCityWithDeps('Marseille', 'marseille')
    await createTrackingEvent({ type: 'search.city', cityId: foreignCity.id })

    const alertUser = await createUser({ id: 'alert-user-1' })
    await createAlert({ userId: alertUser.id, cityId: city.id, maxPrice: 600, name: 'Alerte Lyon' })
    await createAlert({ userId: alertUser.id, cityId: foreignCity.id, maxPrice: 700, name: 'Alerte Marseille' })

    const result = await ownerCaller.ownerStatistics.overview({ period: '30d', ownerId: owner.id })

    expect(result.nbSearchesCity).toBe(2)
    expect(result.nbSearchesDepartment).toBe(1)
    expect(result.nbAlerts).toBe(1)
  })

  it('forbids access for an owner-role user without owner record', async () => {
    await createUser({ id: OWNER_USER_ID, role: 'owner' })

    await expect(ownerCaller.ownerStatistics.overview({ period: '30d' })).rejects.toBeInstanceOf(TRPCError)
  })

  it('isolates byAccommodation rows by owner', async () => {
    const { accommodation } = await setupOwnerWithAccommodation()
    const otherUser = await createUser({ id: OWNER_USER_ID_2, role: 'owner' })
    const otherOwner = await createOwner({ name: 'Owner B', slug: 'owner-b', userId: otherUser.id })
    const otherCity = await createCityWithDeps('Paris', 'paris')
    await createAccommodation({ slug: 'res-b', name: 'Résidence B', ownerId: otherOwner.id, cityId: otherCity.id })

    const result = await ownerCaller.ownerStatistics.byAccommodation({ period: '30d' })
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.items[0].accommodationId).toBe(accommodation.id)

    const resultOther = await ownerCaller2.ownerStatistics.byAccommodation({ period: '30d' })
    expect(resultOther.items).toHaveLength(1)
    expect(resultOther.items[0].name).toBe('Résidence B')
  })
})
