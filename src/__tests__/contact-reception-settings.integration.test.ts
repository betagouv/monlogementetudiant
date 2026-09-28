import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import type { BailleurPermission } from '~/server/bailleur/permissions'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { caller, gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return { ...actual, auth: { ...actual.auth, api: { ...actual.auth.api, signInMagicLink: vi.fn().mockResolvedValue(undefined) } } }
})
vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendApplicationsManagementGrantedEmail: vi.fn().mockResolvedValue(undefined) }
})

const MARINE = 'gest-marine'
const ALEXIS = 'gest-alexis'

let ownerAId: number
let resA: { id: number }
let resB: { id: number }
let resC: { id: number }

const seedGestionnaire = async (id: string, firstname: string, lastname: string, permissions: BailleurPermission[]) => {
  await createUser({ id, name: `${firstname} ${lastname}`, firstname, lastname, email: `${id}@a.com`, role: 'owner' })
  await getTestDb()
    .update(user)
    .set({ ownerId: ownerAId, bailleurRole: 'gestionnaire', bailleurPermissions: permissions })
    .where(eq(user.id, id))
}

const restrictTo = async (userId: string, accommodationIds: number[]) => {
  const db = getTestDb()
  await db.update(user).set({ applicationScopeRestricted: true }).where(eq(user.id, userId))
  await db.delete(bailleurAccommodationScopes).where(eq(bailleurAccommodationScopes.userId, userId))
  if (accommodationIds.length > 0) {
    await db.insert(bailleurAccommodationScopes).values(accommodationIds.map((accommodationId) => ({ userId, accommodationId })))
  }
}

const readUser = async (id: string) => {
  const row = await getTestDb().query.user.findFirst({ where: eq(user.id, id) })
  const scope = await getTestDb()
    .select({ id: bailleurAccommodationScopes.accommodationId })
    .from(bailleurAccommodationScopes)
    .where(eq(bailleurAccommodationScopes.userId, id))
  return {
    permissions: [...(row?.bailleurPermissions ?? [])].sort(),
    restricted: row?.applicationScopeRestricted,
    scope: scope.map((s) => s.id).sort((a, b) => a - b),
  }
}

const readResidences = async () => {
  const rows = await getTestDb().select().from(accommodations).where(eq(accommodations.ownerId, ownerAId)).orderBy(accommodations.id)
  return rows.map((r) => ({ id: r.id, acceptsApplications: r.acceptsApplications, acceptWaitingList: r.acceptWaitingList }))
}

type Row = { accommodationId: number; managerIds: string[]; acceptWaitingList?: boolean }
const save = (rows: Row[], ownerId?: number) =>
  ownerCaller.bailleur.saveContactReceptionSettings({
    ownerId,
    residences: rows.map((r) => ({ acceptWaitingList: false, ...r })),
  })

beforeEach(async () => {
  const db = getTestDb()
  await db.delete(activityLog)

  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Test Owner 2', email: 'owner2@test.com', role: 'owner' })

  const ownerA = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'test-owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
  const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'test-owner-id-2' })
  ownerAId = ownerA.id
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerA.id }).where(eq(user.id, 'test-owner-id'))
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerB.id }).where(eq(user.id, 'test-owner-id-2'))

  resA = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  resB = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  resC = await createAccommodation({ slug: 'res-c', name: 'Res C', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  await createAccommodation({ slug: 'res-other', name: 'Res Other', ownerId: ownerB.id }, [typologyDraft('t1', { nbAvailable: 5 })])

  await seedGestionnaire(MARINE, 'Marine', 'Bleue', ['manage_residences', 'manage_applications'])
  await seedGestionnaire(ALEXIS, 'Alexis', 'Delens', ['manage_residences'])
})

describe('bailleur.getContactReceptionSettings', () => {
  it("n'expose que les gestionnaires, affectés selon leur autorisation et leur périmètre", async () => {
    await restrictTo(MARINE, [resB.id])

    const settings = await ownerCaller.bailleur.getContactReceptionSettings({})

    expect(settings.hasGestionnaires).toBe(true)
    expect(settings.residences.map((r) => [r.name, r.managers.map((m) => m.name)])).toEqual([
      ['Res A', []],
      ['Res B', ['Marine Bleue']],
      ['Res C', []],
    ])
  })

  it('est réservé aux administrateurs', async () => {
    const gestCaller = gestionnaireCallerFactory({ id: MARINE, email: `${MARINE}@a.com`, permissions: ['manage_applications'] })
    await expect(gestCaller.bailleur.getContactReceptionSettings({})).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
  })
})

describe('bailleur.users.list — filtre par rôle', () => {
  it('exclut les administrateurs', async () => {
    const { items } = await ownerCaller.bailleur.users.list({ bailleurRole: 'gestionnaire' })
    expect(items.map((i) => i.id).sort()).toEqual([ALEXIS, MARINE])
  })
})

describe('bailleur.saveContactReceptionSettings', () => {
  it('ouvre les résidences cochées, ferme les autres et écrit la liste d’attente', async () => {
    await save([
      { accommodationId: resA.id, managerIds: [MARINE], acceptWaitingList: true },
      { accommodationId: resB.id, managerIds: [MARINE] },
    ])

    expect(await readResidences()).toEqual([
      { id: resA.id, acceptsApplications: true, acceptWaitingList: true },
      { id: resB.id, acceptsApplications: true, acceptWaitingList: false },
      { id: resC.id, acceptsApplications: false, acceptWaitingList: null },
    ])
  })

  it('restreint un gestionnaire « toutes résidences » retiré d’une résidence cochée', async () => {
    await save([
      { accommodationId: resA.id, managerIds: [MARINE] },
      { accommodationId: resB.id, managerIds: [ALEXIS] },
    ])

    expect(await readUser(MARINE)).toEqual({
      permissions: ['manage_applications', 'manage_residences'],
      restricted: true,
      scope: [resA.id, resC.id],
    })
  })

  it('laisse « toutes résidences » un gestionnaire sélectionné partout', async () => {
    await save([
      { accommodationId: resA.id, managerIds: [MARINE] },
      { accommodationId: resB.id, managerIds: [MARINE] },
    ])

    expect(await readUser(MARINE)).toMatchObject({ restricted: false, scope: [] })
  })

  it('étend le périmètre d’un gestionnaire restreint et accorde le droit', async () => {
    await restrictTo(ALEXIS, [resC.id])

    const result = await save([
      { accommodationId: resA.id, managerIds: [MARINE, ALEXIS] },
      { accommodationId: resB.id, managerIds: [MARINE] },
    ])

    expect(await readUser(ALEXIS)).toEqual({
      permissions: ['manage_applications', 'manage_residences'],
      restricted: true,
      scope: [resA.id, resC.id],
    })
    expect(result.updated).toBe(1)
  })

  it('retire le droit à un gestionnaire sélectionné nulle part', async () => {
    await save([{ accommodationId: resA.id, managerIds: [ALEXIS] }])

    expect((await readUser(MARINE)).permissions).toEqual(['manage_residences'])
  })

  it('refuse de retirer sa seule autorisation à un gestionnaire, sans rien écrire', async () => {
    await getTestDb()
      .update(user)
      .set({ bailleurPermissions: ['manage_applications'] })
      .where(eq(user.id, MARINE))

    await expect(save([{ accommodationId: resA.id, managerIds: [ALEXIS] }])).rejects.toThrow(/seule autorisation/)

    expect((await readUser(ALEXIS)).permissions).toEqual(['manage_residences'])
    expect((await readResidences()).every((r) => r.acceptsApplications)).toBe(true)
  })

  it('exige un gestionnaire par résidence quand le bailleur en a', async () => {
    await expect(save([{ accommodationId: resA.id, managerIds: [] }])).rejects.toThrow(/au moins un gestionnaire/)
  })

  it('accepte une résidence sans gestionnaire quand le bailleur n’en a aucun', async () => {
    await getTestDb().delete(user).where(eq(user.bailleurRole, 'gestionnaire'))

    await expect(save([{ accommodationId: resA.id, managerIds: [] }])).resolves.toEqual({ updated: 0 })
  })

  it('refuse un administrateur comme gestionnaire', async () => {
    await expect(save([{ accommodationId: resA.id, managerIds: ['test-owner-id'] }])).rejects.toThrow(/Seuls les gestionnaires/)
  })

  it('refuse un utilisateur inconnu ou d’un autre bailleur', async () => {
    await expect(save([{ accommodationId: resA.id, managerIds: ['test-owner-id-2'] }])).rejects.toThrow(/Utilisateur non trouve/)
  })

  it('refuse une résidence d’un autre bailleur', async () => {
    const [other] = await getTestDb().select().from(accommodations).where(eq(accommodations.slug, 'res-other'))
    await expect(save([{ accommodationId: other.id, managerIds: [MARINE] }])).rejects.toThrow(/n'appartient pas/)
  })

  it('refuse une résidence en double', async () => {
    await expect(
      save([
        { accommodationId: resA.id, managerIds: [MARINE] },
        { accommodationId: resA.id, managerIds: [MARINE] },
      ]),
    ).rejects.toThrow(/plusieurs fois/)
  })

  it('refuse un bailleur sans parcours de candidature', async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.NONE }).where(eq(owners.id, ownerAId))
    await expect(save([{ accommodationId: resA.id, managerIds: [MARINE] }])).rejects.toThrow(/parcours de candidature/)
  })

  it('refuse un gestionnaire et un visiteur', async () => {
    const gestCaller = gestionnaireCallerFactory({ id: MARINE, email: `${MARINE}@a.com`, permissions: ['manage_applications'] })
    const input = { residences: [{ accommodationId: resA.id, managerIds: [MARINE], acceptWaitingList: false }] }

    await expect(gestCaller.bailleur.saveContactReceptionSettings(input)).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
    await expect(caller.bailleur.saveContactReceptionSettings(input)).rejects.toThrow('UNAUTHORIZED')
  })

  it('journalise les résidences, les modérateurs et les périmètres, puis rien quand rien ne change', async () => {
    const rows = [
      { accommodationId: resA.id, managerIds: [ALEXIS] },
      { accommodationId: resB.id, managerIds: [MARINE] },
    ]
    const readActions = async () =>
      (
        await getTestDb()
          .select()
          .from(activityLog)
          .where(and(eq(activityLog.ownerId, ownerAId)))
      )
        .map((l) => l.action)
        .sort()

    await save(rows)
    expect(await readActions()).toEqual([
      'owner.application_residences_updated',
      'owner.moderation_managers_updated',
      'owner.user_application_scope_updated',
      'owner.user_application_scope_updated',
    ])

    await save(rows)
    expect(await readActions()).toHaveLength(4)
  })
})
