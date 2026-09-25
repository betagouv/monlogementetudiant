import { describe, expect, it } from 'vitest'
import { createAccommodation, createFavoriteAccommodation, createUser } from './fixtures/factories'
import { authenticatedCaller, authenticatedCaller2, caller } from './helpers/test-caller'
import './helpers/setup-integration'

describe('favorites.list', () => {
  it('requires authentication', async () => {
    await expect(caller.favorites.list()).rejects.toThrow('UNAUTHORIZED')
  })

  it('returns favorites of the current user only', async () => {
    const accom1 = await createAccommodation({
      slug: 'fav-1',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    const accom2 = await createAccommodation({
      slug: 'fav-2',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom1.id })
    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom2.id })
    await createFavoriteAccommodation({ userId: 'other-user-id', accommodationId: accom1.id })

    const result = await authenticatedCaller.favorites.list()
    expect(result).toHaveLength(2)
  })

  it('keeps an unpublished residence in the list, flagged as unpublished', async () => {
    const hidden = await createAccommodation({
      slug: 'fav-unpublished',
      published: false,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: hidden.id })

    const result = await authenticatedCaller.favorites.list()

    expect(result).toHaveLength(1)
    expect(result[0]?.accommodation.published).toBe(false)
  })

  it('returns favorites in reverse chronological order', async () => {
    const accom1 = await createAccommodation({
      slug: 'fav-old',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    const accom2 = await createAccommodation({
      slug: 'fav-new',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom1.id })
    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom2.id })

    const result = await authenticatedCaller.favorites.list()
    expect(result[0].accommodation.slug).toBe('fav-new')
    expect(result[1].accommodation.slug).toBe('fav-old')
  })
})

describe('favorites.add', () => {
  it('requires authentication', async () => {
    await expect(caller.favorites.add({ accommodationSlug: 'test' })).rejects.toThrow('UNAUTHORIZED')
  })

  it('adds a favorite', async () => {
    await createUser({ id: 'test-user-id' })
    await createAccommodation({
      slug: 'add-fav-test',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const result = await authenticatedCaller.favorites.add({ accommodationSlug: 'add-fav-test' })
    expect(result.userId).toBe('test-user-id')

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(1)
  })

  it('is idempotent (no error if already favorite)', async () => {
    await createUser({ id: 'test-user-id' })
    await createAccommodation({
      slug: 'idempotent-fav',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    await authenticatedCaller.favorites.add({ accommodationSlug: 'idempotent-fav' })
    await authenticatedCaller.favorites.add({ accommodationSlug: 'idempotent-fav' })

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(1)
  })

  it('throws NOT_FOUND for unknown accommodation', async () => {
    await expect(authenticatedCaller.favorites.add({ accommodationSlug: 'nonexistent' })).rejects.toThrow('Accommodation not found')
  })
})

describe('favorites.remove', () => {
  it('requires authentication', async () => {
    await expect(caller.favorites.remove({ slug: 'test' })).rejects.toThrow('UNAUTHORIZED')
  })

  it('removes a favorite', async () => {
    const accom = await createAccommodation({
      slug: 'remove-fav-test',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom.id })

    await authenticatedCaller.favorites.remove({ slug: 'remove-fav-test' })

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(0)
  })

  it('does not affect other users favorites', async () => {
    const accom = await createAccommodation({
      slug: 'other-user-fav',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await createFavoriteAccommodation({ userId: 'test-user-id', accommodationId: accom.id })
    await createFavoriteAccommodation({ userId: 'test-user-id-2', accommodationId: accom.id })

    await authenticatedCaller.favorites.remove({ slug: 'other-user-fav' })

    const myFavorites = await authenticatedCaller.favorites.list()
    expect(myFavorites).toHaveLength(0)

    const otherFavorites = await authenticatedCaller2.favorites.list()
    expect(otherFavorites).toHaveLength(1)
  })
})

describe('favorites.add', () => {
  it('rejects an unpublished accommodation as if it did not exist', async () => {
    await createUser({ id: 'test-user-id', email: 'test@test.com', role: 'user' })
    await createAccommodation({ slug: 'fav-hidden', published: false, geom: { type: 'Point', coordinates: [2.35, 48.85] } })

    await expect(authenticatedCaller.favorites.add({ accommodationSlug: 'fav-hidden' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
