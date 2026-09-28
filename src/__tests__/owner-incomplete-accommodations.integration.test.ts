import { describe, expect, it } from 'vitest'
import { getOwnerIncompleteAccommodations } from '../server/bailleur/get-owner-incomplete-accommodations'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'

const completeFields = {
  residenceType: 'residence-etudiante',
  targetAudience: 'etudiants' as const,
  scholarshipHoldersPriority: false,
  socialHousingRequired: false,
  acceptWaitingList: true,
  nbAccessibleApartments: 0,
  imagesUrls: ['https://example.com/photo.jpg'],
}

const completeTypology = typologyDraft('t1', { priceMin: 400, priceMax: 500, superficieMin: 18, superficieMax: 22 })

async function setupOwner(slug = 'owner-a') {
  const user = await createUser({ id: `user-${slug}`, role: 'owner' })
  return createOwner({ name: slug, slug, userId: user.id })
}

describe('getOwnerIncompleteAccommodations', () => {
  it('ignores complete residences', async () => {
    const owner = await setupOwner()
    await createAccommodation({ ownerId: owner.id, ...completeFields }, [completeTypology])

    expect(await getOwnerIncompleteAccommodations(owner.id)).toEqual([])
  })

  it.each([
    ['residenceType', { residenceType: null }],
    ['residenceType vide', { residenceType: '' }],
    ['targetAudience', { targetAudience: null }],
    ['scholarshipHoldersPriority', { scholarshipHoldersPriority: null }],
    ['socialHousingRequired', { socialHousingRequired: null }],
    ['acceptWaitingList', { acceptWaitingList: null }],
    ['nbAccessibleApartments', { nbAccessibleApartments: null }],
    ['imagesUrls null', { imagesUrls: null }],
    ['imagesUrls vide', { imagesUrls: [] }],
  ])('flags a residence missing %s', async (_, override) => {
    const owner = await setupOwner()
    await createAccommodation({ ownerId: owner.id, name: 'Résidence X', slug: 'res-x', ...completeFields, ...override }, [completeTypology])

    expect(await getOwnerIncompleteAccommodations(owner.id)).toEqual([{ name: 'Résidence X', slug: 'res-x' }])
  })

  it('flags a residence without typology', async () => {
    const owner = await setupOwner()
    await createAccommodation({ ownerId: owner.id, slug: 'res-x', ...completeFields })

    expect(await getOwnerIncompleteAccommodations(owner.id)).toHaveLength(1)
  })

  it.each([
    'priceMin',
    'priceMax',
    'superficieMin',
    'superficieMax',
  ] as const)('flags a residence with a typology missing %s', async (field) => {
    const owner = await setupOwner()
    await createAccommodation({ ownerId: owner.id, slug: 'res-x', ...completeFields }, [
      completeTypology,
      typologyDraft('t2', { priceMin: 500, priceMax: 600, superficieMin: 30, superficieMax: 40, [field]: null }),
    ])

    expect(await getOwnerIncompleteAccommodations(owner.id)).toHaveLength(1)
  })

  it("does not return other owners' residences", async () => {
    const owner = await setupOwner('owner-a')
    const other = await setupOwner('owner-b')
    await createAccommodation({ ownerId: other.id, slug: 'res-other' })

    expect(await getOwnerIncompleteAccommodations(owner.id)).toEqual([])
  })
})
