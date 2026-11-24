import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccommodationScope } from '~/server/bailleur/accommodation-scope'
import { isSurveyPendingForUser } from '~/server/scholarship-survey/service'
import { accommodations } from '../server/db/schema/accommodations'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { scholarshipSurveyAnswers, scholarshipSurveyOwners } from '../server/db/schema/scholarship-survey'
import { createAccommodation, createExternalSource, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

const surveyState = vi.hoisted(() => ({ active: true }))

vi.mock('~/server/scholarship-survey/active', async () => {
  const actual = await vi.importActual<typeof import('~/server/scholarship-survey/active')>('~/server/scholarship-survey/active')
  return { ...actual, isScholarshipSurveyActive: () => surveyState.active }
})

const GEST_A = { id: 'gest-a', email: 'gest-a@test.com' }
const GEST_B = { id: 'gest-b', email: 'gest-b@test.com' }

const gestCaller = (
  g: { id: string; email: string },
  permissions: ('manage_residences' | 'manage_applications')[] = ['manage_residences'],
) => gestionnaireCallerFactory({ ...g, ownerSuffix: g.id, permissions })

const empty = { scholarshipCount: null, scholarshipRate: null, notMeasured: false }
const count = (accommodationId: number, value = 10) => ({ accommodationId, ...empty, scholarshipCount: value })
const notMeasured = (accommodationId: number) => ({ accommodationId, ...empty, notMeasured: true })

const restrictTo = async (userId: string, accommodationIds: number[]) => {
  const db = getTestDb()
  await db.update(user).set({ applicationScopeRestricted: true }).where(eq(user.id, userId))
  await db.insert(bailleurAccommodationScopes).values(accommodationIds.map((accommodationId) => ({ userId, accommodationId })))
}

let ownerAId: number
let ownerBId: number
let res1: { id: number }
let res2: { id: number }
let unpublished: { id: number }
let crous: { id: number }
let otherOwnerRes: { id: number }

beforeEach(async () => {
  surveyState.active = true
  const db = getTestDb()

  await createUser({ id: 'test-owner-id', name: 'Admin A', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Admin B', email: 'owner2@test.com', role: 'owner' })
  const ownerA = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id' })
  const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'test-owner-id-2' })
  ownerAId = ownerA.id
  ownerBId = ownerB.id
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerAId }).where(eq(user.id, 'test-owner-id'))
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerBId }).where(eq(user.id, 'test-owner-id-2'))

  for (const g of [GEST_A, GEST_B]) {
    await createUser({ id: g.id, name: 'Gestionnaire', email: g.email, role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: ownerAId, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, g.id))
  }

  res1 = await createAccommodation({ slug: 'res-1', name: 'Résidence Alpha', ownerId: ownerAId })
  res2 = await createAccommodation({ slug: 'res-2', name: 'Résidence Beta', ownerId: ownerAId })
  unpublished = await createAccommodation({ slug: 'res-draft', name: 'Brouillon', ownerId: ownerAId, published: false })
  crous = await createAccommodation({ slug: 'res-crous', name: 'Crous', ownerId: ownerAId })
  await createExternalSource({ accommodationId: crous.id, source: 'crous', sourceId: 'c-1' })
  otherOwnerRes = await createAccommodation({ slug: 'res-b', name: 'Autre', ownerId: ownerBId })
})

describe('scholarshipSurvey.getForm', () => {
  it('ne liste que les résidences publiées, hors CROUS, du bailleur', async () => {
    const form = await ownerCaller.scholarshipSurvey.getForm({})
    expect(form.residences.map((r) => r.id)).toEqual([res1.id, res2.id])
    expect(form.ownerCompleted).toBe(false)
  })

  it('limite un gestionnaire restreint à son périmètre', async () => {
    await restrictTo(GEST_A.id, [res1.id])
    const form = await gestCaller(GEST_A).scholarshipSurvey.getForm({})
    expect(form.residences.map((r) => r.id)).toEqual([res1.id])
  })

  it('refuse un gestionnaire sans manage_residences', async () => {
    await expect(gestCaller(GEST_A, ['manage_applications']).scholarshipSurvey.getForm({})).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('scholarshipSurvey.save', () => {
  it('refuse une résidence hors périmètre sans rien écrire', async () => {
    for (const res of [otherOwnerRes, unpublished, crous]) {
      await expect(ownerCaller.scholarshipSurvey.save({ answers: [count(res1.id), count(res.id)] })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    }
    expect(await getTestDb().select().from(scholarshipSurveyAnswers)).toHaveLength(0)
  })

  it('refuse une résidence hors du scope du gestionnaire', async () => {
    await restrictTo(GEST_A.id, [res1.id])
    await expect(gestCaller(GEST_A).scholarshipSurvey.save({ answers: [count(res2.id)] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('conserve un brouillon visible par un collègue', async () => {
    await gestCaller(GEST_A).scholarshipSurvey.save({ answers: [{ accommodationId: res1.id, ...empty, scholarshipRate: 35 }] })
    const form = await ownerCaller.scholarshipSurvey.getForm({})
    expect(form.residences.find((r) => r.id === res1.id)?.answer).toMatchObject({ scholarshipRate: 35, notMeasured: false })
    expect(form.residences.find((r) => r.id === res2.id)?.answer).toBeNull()
    const [row] = await getTestDb().select().from(scholarshipSurveyAnswers)
    expect(row.updatedByUserId).toBe(GEST_A.id)
  })

  it('supprime la ligne quand la réponse est vidée', async () => {
    await ownerCaller.scholarshipSurvey.save({ answers: [count(res1.id)] })
    await ownerCaller.scholarshipSurvey.save({ answers: [{ accommodationId: res1.id, ...empty }] })
    expect(await getTestDb().select().from(scholarshipSurveyAnswers)).toHaveLength(0)
  })
})

describe('scholarshipSurvey.submit', () => {
  it('renvoie les résidences manquantes sans compléter le bailleur', async () => {
    const result = await ownerCaller.scholarshipSurvey.submit({ answers: [count(res1.id)] })
    expect(result).toEqual({ missing: [{ id: res2.id, name: 'Résidence Beta' }], ownerCompleted: false })
    expect(await getTestDb().select().from(scholarshipSurveyOwners)).toHaveLength(0)
  })

  it('complète le bailleur pour tous ses utilisateurs', async () => {
    const result = await gestCaller(GEST_A).scholarshipSurvey.submit({ answers: [count(res1.id), notMeasured(res2.id)] })
    expect(result).toEqual({ missing: [], ownerCompleted: true })
    const [completion] = await getTestDb().select().from(scholarshipSurveyOwners)
    expect(completion).toMatchObject({ ownerId: ownerAId, completedByUserId: GEST_A.id })
    for (const id of ['test-owner-id', GEST_A.id, GEST_B.id]) {
      expect(await isSurveyPendingForUser(ownerAId, await getAccommodationScope(id))).toBe(false)
    }
  })

  it('complète au dernier envoi un parc réparti entre gestionnaires restreints', async () => {
    await restrictTo(GEST_A.id, [res1.id])
    await restrictTo(GEST_B.id, [res2.id])
    expect((await gestCaller(GEST_A).scholarshipSurvey.submit({ answers: [count(res1.id)] })).ownerCompleted).toBe(false)
    expect((await gestCaller(GEST_B).scholarshipSurvey.submit({ answers: [count(res2.id)] })).ownerCompleted).toBe(true)
  })

  it('ignore les réponses hors périmètre dans le calcul de complétion', async () => {
    await ownerCaller.scholarshipSurvey.save({ answers: [count(res1.id)] })
    await getTestDb().update(accommodations).set({ published: false }).where(eq(accommodations.id, res1.id))
    const result = await ownerCaller.scholarshipSurvey.submit({ answers: [count(res2.id)] })
    expect(result).toEqual({ missing: [], ownerCompleted: true })
  })
})

describe('isSurveyPendingForUser', () => {
  it('est faux pour un gestionnaire restreint dont le périmètre est rempli, vrai pour l’administrateur', async () => {
    await restrictTo(GEST_A.id, [res1.id])
    await gestCaller(GEST_A).scholarshipSurvey.submit({ answers: [count(res1.id)] })
    expect(await isSurveyPendingForUser(ownerAId, await getAccommodationScope(GEST_A.id))).toBe(false)
    expect(await isSurveyPendingForUser(ownerAId, await getAccommodationScope('test-owner-id'))).toBe(true)
  })

  it('est faux pour un bailleur sans résidence éligible', async () => {
    await getTestDb().update(accommodations).set({ published: false }).where(eq(accommodations.id, otherOwnerRes.id))
    expect(await isSurveyPendingForUser(ownerBId, await getAccommodationScope('test-owner-id-2'))).toBe(false)
  })

  it('est faux une fois l’enquête fermée', async () => {
    surveyState.active = false
    expect(await isSurveyPendingForUser(ownerAId, await getAccommodationScope('test-owner-id'))).toBe(false)
  })
})

describe('après la date de fin', () => {
  it('refuse toutes les procédures', async () => {
    surveyState.active = false
    await expect(ownerCaller.scholarshipSurvey.getForm({})).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(ownerCaller.scholarshipSurvey.save({ answers: [count(res1.id)] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(ownerCaller.scholarshipSurvey.submit({ answers: [count(res1.id)] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
