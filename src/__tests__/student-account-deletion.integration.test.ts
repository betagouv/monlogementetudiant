import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  budgetSimulations,
  contactRequests,
  dossierFacileApplications,
  dossierFacileDocuments,
  dossierFacileTenants,
  favoriteAccommodations,
  housingAidSimulations,
  session,
  studentAlerts,
  studentGoalLists,
  studentGoals,
  supportTickets,
  user,
} from '~/server/db/schema'
import { deleteUserAccount } from '~/server/users/delete-account'
import { typologyDraft } from '../server/lib/typologies'
import {
  createAccommodation,
  createAlert,
  createDossierFacileApplication,
  createDossierFacileDocument,
  createDossierFacileTenant,
  createFavoriteAccommodation,
  createOwner,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const mockedEnv = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('~/server/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/server/env')>()
  Object.assign(mockedEnv, actual.env, { NEXT_PUBLIC_APP_ENV: 'production' })
  return { env: mockedEnv }
})

const deleteBrevoContact = vi.hoisted(() => vi.fn())
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, deleteBrevoContact: (...args: unknown[]) => deleteBrevoContact(...args) }
})

beforeEach(async () => {
  deleteBrevoContact.mockClear()
  deleteBrevoContact.mockResolvedValue(undefined)
  mockedEnv.NEXT_PUBLIC_APP_ENV = 'production'
  await createUser({ id: 'test-user-id', name: 'Test User', email: 'test@test.com', role: 'user' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

/** Peuple toutes les tables de l'espace étudiant pour vérifier l'effacement intégral. */
async function seedStudentData(userId: string) {
  const db = getTestDb()
  const owner = await createOwner({ name: 'Owner Deletion', slug: 'owner-deletion', contactMode: EOwnerContactMode.CONTACTS })
  const accommodation = await createAccommodation({ slug: 'res-deletion', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 2 })])

  await db.insert(contactRequests).values({
    userId,
    accommodationId: accommodation.id,
    firstname: 'Toto',
    lastname: 'Tutu',
    email: 'test@test.com',
    confirmedAt: new Date(),
  })

  const tenant = await createDossierFacileTenant({ userId })
  await createDossierFacileDocument({ tenantId: tenant!.id })
  await createDossierFacileApplication({ tenantId: tenant!.id, accommodationSlug: 'res-deletion', apartmentType: 't1' })

  await createAlert({ userId, maxPrice: 600 })
  await createFavoriteAccommodation({ userId, accommodationId: accommodation.id })
  await db.insert(budgetSimulations).values({ userId, inputs: {} as never })
  await db.insert(housingAidSimulations).values({ userId, inputs: {} as never })
  const [goalList] = await db.insert(studentGoalLists).values({ userId }).returning()
  await db.insert(studentGoals).values({ listId: goalList.id, title: 'Visiter la résidence', dueDelay: 'one_week', dueAt: new Date() })
  await db.insert(supportTickets).values({ userId, category: 'account', message: 'Besoin d’aide' })
  await db.insert(session).values({ id: `session-${userId}`, userId, token: `token-${userId}`, expiresAt: new Date(Date.now() + 3600000) })
}

describe('student.deleteAccount', () => {
  it('supprime le compte et toutes les données rattachées', async () => {
    const db = getTestDb()
    await seedStudentData('test-user-id')

    const result = await authenticatedCaller.student.deleteAccount()
    expect(result).toEqual({ success: true })

    expect(await db.query.user.findFirst({ where: eq(user.id, 'test-user-id') })).toBeUndefined()

    // Rétention alignée sur la vie du compte : plus aucune trace dans l'espace étudiant.
    const remnants = await Promise.all([
      db.select().from(contactRequests).where(eq(contactRequests.userId, 'test-user-id')),
      db.select().from(dossierFacileTenants).where(eq(dossierFacileTenants.userId, 'test-user-id')),
      db.select().from(studentAlerts).where(eq(studentAlerts.userId, 'test-user-id')),
      db.select().from(favoriteAccommodations).where(eq(favoriteAccommodations.userId, 'test-user-id')),
      db.select().from(budgetSimulations).where(eq(budgetSimulations.userId, 'test-user-id')),
      db.select().from(housingAidSimulations).where(eq(housingAidSimulations.userId, 'test-user-id')),
      db.select().from(studentGoalLists).where(eq(studentGoalLists.userId, 'test-user-id')),
      db.select().from(supportTickets).where(eq(supportTickets.userId, 'test-user-id')),
      db.select().from(session).where(eq(session.userId, 'test-user-id')),
    ])
    for (const rows of remnants) expect(rows).toHaveLength(0)

    // Les cascades de second niveau suivent le dossier DossierFacile.
    expect(await db.select().from(dossierFacileDocuments)).toHaveLength(0)
    expect(await db.select().from(dossierFacileApplications)).toHaveLength(0)
    expect(await db.select().from(studentGoals)).toHaveLength(0)

    expect(deleteBrevoContact).toHaveBeenCalledWith('test@test.com')
  })

  it('refuse la suppression pour un compte non étudiant', async () => {
    await expect(adminCaller.student.deleteAccount()).rejects.toThrow('Seul un compte étudiant peut être supprimé ici')
    await expect(ownerCaller.student.deleteAccount()).rejects.toThrow()
  })

  it('aboutit même si la suppression du contact Brevo échoue', async () => {
    const db = getTestDb()
    deleteBrevoContact.mockRejectedValueOnce(new Error('Brevo indisponible'))

    await expect(authenticatedCaller.student.deleteAccount()).resolves.toEqual({ success: true })
    expect(await db.query.user.findFirst({ where: eq(user.id, 'test-user-id') })).toBeUndefined()
  })

  it("n'appelle pas Brevo hors production", async () => {
    mockedEnv.NEXT_PUBLIC_APP_ENV = 'staging'

    await authenticatedCaller.student.deleteAccount()
    expect(deleteBrevoContact).not.toHaveBeenCalled()
  })
})

describe('deleteUserAccount', () => {
  it('est idempotent sur un compte inconnu', async () => {
    expect(await deleteUserAccount('does-not-exist')).toBeNull()
    expect(deleteBrevoContact).not.toHaveBeenCalled()
  })
})

describe('admin.users.delete', () => {
  it('supprime le compte et le contact Brevo via la même routine', async () => {
    const db = getTestDb()
    await createUser({ id: 'student-to-delete', email: 'student-to-delete@test.com', role: 'user' })

    const result = await adminCaller.admin.users.delete({ id: 'student-to-delete' })
    expect(result).toEqual({ id: 'student-to-delete' })

    expect(await db.query.user.findFirst({ where: eq(user.id, 'student-to-delete') })).toBeUndefined()
    expect(deleteBrevoContact).toHaveBeenCalledWith('student-to-delete@test.com')
  })
})
