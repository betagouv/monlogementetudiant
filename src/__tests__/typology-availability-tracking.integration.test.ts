import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { persistTypologies, typologyDraft } from '~/server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { gestionnaireCallerFactory } from './helpers/test-caller'

const readTypologies = async (accommodationId: number) => {
  const db = getTestDb()
  return db.select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, accommodationId))
}

const readTypology = async (accommodationId: number, type: 't1' | 't2') => {
  const db = getTestDb()
  const [row] = await db
    .select()
    .from(accommodationTypologies)
    .where(and(eq(accommodationTypologies.accommodationId, accommodationId), eq(accommodationTypologies.type, type)))
    .limit(1)
  return row ?? null
}

let accommodationId: number

beforeEach(async () => {
  await createUser({ id: 'test-gestionnaire-id', name: 'Gestionnaire', email: 'gest@test.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur Dispo', slug: 'bailleur-dispo', userId: 'test-gestionnaire-id' })
  const accommodation = await createAccommodation({ name: 'Résidence Dispo', slug: 'residence-dispo', ownerId: owner.id })
  accommodationId = accommodation.id
})

describe('persistTypologies — horodatage des disponibilités', () => {
  it('horodate une typologie créée avec une disponibilité, et son auteur', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 })], {
      updatedBy: 'test-gestionnaire-id',
    })

    const t1 = await readTypology(accommodationId, 't1')
    expect(t1?.availabilityUpdatedAt).toBeInstanceOf(Date)
    expect(t1?.availabilityUpdatedBy).toBe('test-gestionnaire-id')
  })

  it('laisse vierge une typologie déclarée sans disponibilité', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { priceMin: 400 })], { updatedBy: 'test-gestionnaire-id' })

    const t1 = await readTypology(accommodationId, 't1')
    expect(t1?.availabilityUpdatedAt).toBeNull()
    expect(t1?.availabilityUpdatedBy).toBeNull()
  })

  it('conserve la date quand la résidence est réenregistrée sans toucher aux disponibilités', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 })], {
      updatedBy: 'test-gestionnaire-id',
    })
    const initial = await readTypology(accommodationId, 't1')

    // Le loyer change, la disponibilité non.
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3, priceMin: 450 })], {
      updatedBy: 'autre-utilisateur',
    })

    const after = await readTypology(accommodationId, 't1')
    expect(after?.priceMin).toBe(450)
    expect(after?.availabilityUpdatedAt).toEqual(initial?.availabilityUpdatedAt)
    expect(after?.availabilityUpdatedBy).toBe('test-gestionnaire-id')
  })

  it('retamponne quand la disponibilité change', async () => {
    const db = getTestDb()
    await createUser({ id: 'autre-id', name: 'Autre', email: 'autre@test.com', role: 'owner' })
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 })], {
      updatedBy: 'test-gestionnaire-id',
    })
    const initial = await readTypology(accommodationId, 't1')

    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 7 })], { updatedBy: 'autre-id' })

    const after = await readTypology(accommodationId, 't1')
    expect(after?.availabilityUpdatedAt?.getTime()).toBeGreaterThanOrEqual(initial!.availabilityUpdatedAt!.getTime())
    expect(after?.availabilityUpdatedBy).toBe('autre-id')
  })

  it('efface la date quand la disponibilité est effacée', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 })], {
      updatedBy: 'test-gestionnaire-id',
    })

    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: null })], {
      updatedBy: 'test-gestionnaire-id',
    })

    const after = await readTypology(accommodationId, 't1')
    expect(after?.availabilityUpdatedAt).toBeNull()
    expect(after?.availabilityUpdatedBy).toBeNull()
  })

  it('ne tamponne pas une écriture d’import ou de script', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 2 })])

    const t1 = await readTypology(accommodationId, 't1')
    expect(t1?.nbAvailable).toBe(2)
    expect(t1?.availabilityUpdatedAt).toBeNull()
    expect(t1?.availabilityUpdatedBy).toBeNull()
  })

  it('laisse intacte la trace d’un gestionnaire quand un import repasse derrière', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 })], {
      updatedBy: 'test-gestionnaire-id',
    })
    const initial = await readTypology(accommodationId, 't1')

    // Import sans auteur : il met la disponibilité à jour mais ne s'attribue pas le suivi.
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 8 })])

    const after = await readTypology(accommodationId, 't1')
    expect(after?.nbAvailable).toBe(8)
    expect(after?.availabilityUpdatedAt).toEqual(initial?.availabilityUpdatedAt)
    expect(after?.availabilityUpdatedBy).toBe('test-gestionnaire-id')
  })
})

describe('persistTypologies — remplacement par upsert', () => {
  it('garde l’identité de la ligne au lieu de la recréer', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 3 })])
    const before = await readTypology(accommodationId, 't1')

    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 4 })])

    const after = await readTypology(accommodationId, 't1')
    expect(after?.id).toBe(before?.id)
    expect(after?.nbAvailable).toBe(4)
  })

  it('supprime les typologies absentes du nouvel ensemble', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 3 }), typologyDraft('t2', { nbAvailable: 1 })])

    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 3 })])

    const rows = await readTypologies(accommodationId)
    expect(rows.map((r) => r.type)).toEqual(['t1'])
  })

  it('vide toutes les typologies quand l’ensemble fourni est vide', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbAvailable: 3 })])

    await persistTypologies(db, accommodationId, [])

    expect(await readTypologies(accommodationId)).toHaveLength(0)
  })
})

describe('bailleur.updateAvailability — horodatage de bout en bout', () => {
  it('enregistre le gestionnaire qui met à jour les disponibilités', async () => {
    const db = getTestDb()
    await persistTypologies(db, accommodationId, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 1 })])

    const caller = gestionnaireCallerFactory({ permissions: ['manage_availability'] })
    await caller.bailleur.updateAvailability({ slug: 'residence-dispo', availability: [{ type: 't1', nbAvailable: 6 }] })

    const t1 = await readTypology(accommodationId, 't1')
    expect(t1?.nbAvailable).toBe(6)
    expect(t1?.availabilityUpdatedBy).toBe('test-gestionnaire-id')
    expect(t1?.availabilityUpdatedAt?.getTime()).toBeGreaterThan(Date.now() - 60_000)
  })
})
