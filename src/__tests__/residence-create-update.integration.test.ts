import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TypologyType } from '../schemas/accommodations/typology'
import { accommodations } from '../server/db/schema/accommodations'
import { createOwner, createUser } from './fixtures/factories'
import { ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'
import { loadTypologies } from './helpers/typologies'

// Exercises the residence create/update FORM write path (bailleur mutations -> persistTypologies +
// typologyAggregates). The display side (typologiesByType -> getBySlug) is covered separately in
// accommodations.integration.test.ts.

type TypologyFields = {
  priceMin: number
  priceMax: number
  superficieMin: number
  superficieMax: number
  colocation: boolean
  nbTotal: number
  nbAvailable: number
}

const fullTypology = (type: TypologyType, over: Partial<TypologyFields> = {}) => ({
  type,
  priceMin: 400,
  priceMax: 600,
  superficieMin: 15,
  superficieMax: 25,
  colocation: false,
  nbTotal: 10,
  nbAvailable: 5,
  ...over,
})

async function accommodationBySlug(slug: string) {
  const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.slug, slug))
  return row
}

describe('residence create/update form write path', () => {
  // createOwner({ userId }) links by UPDATE-ing an existing user row, so the user must exist first.
  beforeEach(async () => {
    await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  })

  it('create persists the virtual tour, equipments and independent apartment counts', async () => {
    await createOwner({ name: 'Owner Fields', slug: 'owner-fields', userId: 'test-owner-id' })

    const { slug } = await ownerCaller.bailleur.create({
      name: 'Résidence Champs',
      addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      virtualTourUrl: 'https://my.matterport.com/show/?m=bwtYCMgopaH',
      typologies: [fullTypology('t1')],
      wifi: true,
      laundryRoom: true,
      bathroom: 'private',
      kitchenType: 'shared',
      nbAccessibleApartments: 2,
      nbColivingApartments: 3,
    })

    const row = await accommodationBySlug(slug)
    expect(row.virtualTourUrl).toBe('https://my.matterport.com/show/?m=bwtYCMgopaH')
    expect(row.wifi).toBe(true)
    expect(row.laundryRoom).toBe(true)
    expect(row.refrigerator).toBeNull()
    expect(row.bathroom).toBe('private')
    expect(row.kitchenType).toBe('shared')
    expect(row.nbAccessibleApartments).toBe(2)
    expect(row.nbColivingApartments).toBe(3)
  })

  it('create stores no virtual tour when the field is left empty', async () => {
    await createOwner({ name: 'Owner Empty', slug: 'owner-empty', userId: 'test-owner-id' })

    const { slug } = await ownerCaller.bailleur.create({
      name: 'Résidence Vide',
      addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      virtualTourUrl: '',
      typologies: [fullTypology('t1')],
    })

    expect((await accommodationBySlug(slug)).virtualTourUrl).toBeNull()
  })

  it('create persists typology child rows and the derived parent aggregates', async () => {
    await createOwner({ name: 'Owner Flow', slug: 'owner-flow', userId: 'test-owner-id' })

    const { slug } = await ownerCaller.bailleur.create({
      name: 'Résidence Flow',
      addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      published: true,
      typologies: [
        fullTypology('t1', { priceMin: 400, priceMax: 600, nbTotal: 10, nbAvailable: 4 }),
        fullTypology('t3', { priceMin: 800, priceMax: 1000, nbTotal: 2, nbAvailable: 0, colocation: true }),
      ],
    })

    const acc = await accommodationBySlug(slug)
    const typos = await loadTypologies(acc.id)
    expect(typos.t1?.priceMin).toBe(400)
    expect(typos.t1?.nbTotal).toBe(10)
    expect(typos.t3?.priceMax).toBe(1000)
    expect(typos.t3?.colocation).toBe(true)

    // Parent aggregates derived from the typology array.
    expect(acc.nbTotalApartments).toBe(12)
    expect(acc.priceMin).toBe(400)
    expect(acc.priceMax).toBe(1000)
    expect(acc.nbAvailableApartments).toBe(4)
  })

  it('update replaces the typologies and recomputes the parent aggregates', async () => {
    await createOwner({ name: 'Owner Flow 2', slug: 'owner-flow-2', userId: 'test-owner-id' })

    const { slug } = await ownerCaller.bailleur.create({
      name: 'Résidence Edit',
      addresses: [{ address: '2 rue Neuve', city: 'Paris', postalCode: '75002' }],
      externalUrl: 'https://example.com',
      published: true,
      typologies: [fullTypology('t1', { priceMin: 400, priceMax: 600, nbTotal: 10 })],
    })

    await ownerCaller.bailleur.update({
      slug,
      typologies: [
        fullTypology('t2', { priceMin: 700, priceMax: 900, nbTotal: 8, nbAvailable: 3 }),
        fullTypology('t4', { priceMin: 1100, priceMax: 1300, nbTotal: 1, nbAvailable: 1, colocation: true }),
      ],
    })

    const acc = await accommodationBySlug(slug)
    const typos = await loadTypologies(acc.id)
    expect(typos.t1).toBeUndefined() // replaced
    expect(typos.t2?.priceMin).toBe(700)
    expect(typos.t4?.nbTotal).toBe(1)

    expect(acc.nbTotalApartments).toBe(9)
    expect(acc.priceMin).toBe(700)
    expect(acc.priceMax).toBe(1300)
    expect(acc.nbAvailableApartments).toBe(4)
  })
})
