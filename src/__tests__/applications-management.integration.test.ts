import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createDossierFacileTenant, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

const { grantedEmail, suspendedEmail } = vi.hoisted(() => ({
  grantedEmail: vi.fn().mockResolvedValue(undefined),
  suspendedEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return { ...actual, auth: { ...actual.auth, api: { ...actual.auth.api, signInMagicLink: vi.fn().mockResolvedValue(undefined) } } }
})
vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return {
    ...actual,
    sendContactRequestConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendApplicationsManagementGrantedEmail: grantedEmail,
    sendApplicationsSuspendedEmail: suspendedEmail,
  }
})

const contactInput = {
  firstname: 'Toto',
  lastname: 'Tutu',
  email: 'tototutu@tete.com',
  phone: '0102030405',
  birthdate: '2003-04-15',
  scholarshipStatus: 'yes',
} as const

const GEST = { id: 'gest-a', email: 'gest-a@a.com' }
const gestCaller = (permissions: Array<'manage_applications' | 'manage_residences'> = ['manage_applications', 'manage_residences']) =>
  gestionnaireCallerFactory({ ...GEST, permissions })

let ownerAId: number
let resIn: { id: number; slug: string }
let resOut: { id: number; slug: string }

const restrictTo = async (userId: string, accommodationIds: number[]) => {
  const db = getTestDb()
  await db.update(user).set({ applicationScopeRestricted: true }).where(eq(user.id, userId))
  await db.delete(bailleurAccommodationScopes).where(eq(bailleurAccommodationScopes.userId, userId))
  if (accommodationIds.length > 0) {
    await db.insert(bailleurAccommodationScopes).values(accommodationIds.map((accommodationId) => ({ userId, accommodationId })))
  }
}

const readResidence = async (id: number) => {
  const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.id, id))
  return row
}

beforeEach(async () => {
  const db = getTestDb()
  await db.delete(activityLog)
  grantedEmail.mockClear()
  suspendedEmail.mockClear()

  await createUser({ id: 'test-user-id', name: 'Etudiant', email: 'etudiant@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', firstname: 'Alice', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'admin-a2', name: 'Admin A2', firstname: 'Bob', email: 'admin-a2@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Test Owner 2', email: 'owner2@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })

  const ownerA = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'test-owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
  const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'test-owner-id-2' })
  ownerAId = ownerA.id

  for (const id of ['test-owner-id', 'admin-a2']) {
    await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerA.id }).where(eq(user.id, id))
  }
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerB.id }).where(eq(user.id, 'test-owner-id-2'))

  resIn = await createAccommodation({ slug: 'res-in', name: 'Res In', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  resOut = await createAccommodation({ slug: 'res-out', name: 'Res Out', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])

  await createUser({ id: GEST.id, name: 'Gest A', firstname: 'Gest', lastname: 'A', email: GEST.email, role: 'owner' })
  await db
    .update(user)
    .set({ ownerId: ownerA.id, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications', 'manage_residences'] })
    .where(eq(user.id, GEST.id))
})

describe('bailleur.setApplicationsSuspended', () => {
  it('suspend puis reprend les candidatures sur une résidence', async () => {
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    let row = await readResidence(resIn.id)
    expect(row.applicationsSuspendedAt).toBeInstanceOf(Date)
    expect(row.applicationsSuspendedById).toBe(GEST.id)

    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: false })
    row = await readResidence(resIn.id)
    expect(row.applicationsSuspendedAt).toBeNull()
    expect(row.applicationsSuspendedById).toBeNull()
  })

  it('une résidence suspendue refuse les demandes de contact et reste dans la grille', async () => {
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-out', suspended: true })

    await expect(caller.contacts.create({ accommodationSlug: 'res-out', ...contactInput })).rejects.toThrow(/n'accepte pas/)
    await expect(caller.contacts.create({ accommodationSlug: 'res-in', ...contactInput })).resolves.toBeDefined()

    const grid = await gestCaller().bailleur.listResidencesWithContactCounts({})
    expect(grid.residences.map((r) => [r.slug, r.applicationsSuspended])).toEqual([
      ['res-in', false],
      ['res-out', true],
    ])
    const board = await gestCaller().bailleur.listContactsByResidence({ slug: 'res-out' })
    expect(board.residence.applicationsSuspended).toBe(true)
  })

  it('une résidence suspendue refuse les candidatures DossierFacile', async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.DOSSIER_FACILE }).where(eq(owners.id, ownerAId))
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-out', suspended: true })
    await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-susp', status: 'verified' })

    await expect(authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-out', apartmentType: 't1' })).rejects.toThrow(
      /n'accepte pas/,
    )
  })

  it('la page publique masque le parcours de candidature', async () => {
    await getTestDb().execute(
      sql`update accommodation_address set geom = ST_SetSRID(ST_MakePoint(4.39, 45.43), 4326) where accommodation_id in (${resIn.id}, ${resOut.id})`,
    )
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-out', suspended: true })

    expect((await caller.accommodations.getBySlug({ slug: 'res-in' })).owner?.contactMode).toBe(EOwnerContactMode.CONTACTS)
    expect((await caller.accommodations.getBySlug({ slug: 'res-out' })).owner?.contactMode).toBe(EOwnerContactMode.NONE)
  })

  it('refuse une résidence hors du périmètre du gestionnaire', async () => {
    await restrictTo(GEST.id, [resIn.id])

    await expect(gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-out', suspended: true })).rejects.toThrow()
    expect((await readResidence(resOut.id)).applicationsSuspendedAt).toBeNull()
  })

  it('refuse un gestionnaire sans droit de gestion des candidatures', async () => {
    await expect(gestCaller(['manage_residences']).bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })).rejects.toThrow()
  })

  it('refuse une résidence fermée aux candidatures par l’administrateur', async () => {
    await getTestDb().update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, resOut.id))

    await expect(ownerCaller.bailleur.setApplicationsSuspended({ slug: 'res-out', suspended: true })).rejects.toThrow(
      /pas ouverte aux candidatures/,
    )
  })

  it('prévient les administrateurs du bailleur, sauf l’auteur', async () => {
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    expect(suspendedEmail.mock.calls.map(([to]) => to).sort()).toEqual(['admin-a2@test.com', 'owner@test.com'])
    expect(suspendedEmail).toHaveBeenCalledWith(
      'owner@test.com',
      expect.objectContaining({
        firstname: 'Alice',
        residenceName: 'Res In',
        suspendedBy: 'Test Gestionnaire',
        ownerName: 'Bailleur A',
        url: 'http://localhost:3000/bailleur/contacts/res-in',
      }),
    )

    suspendedEmail.mockClear()
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: false })
    await ownerCaller.bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    expect(suspendedEmail.mock.calls.map(([to]) => to)).toEqual(['admin-a2@test.com'])
  })

  it("n'envoie rien à la reprise ni sur une suspension déjà en place", async () => {
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    suspendedEmail.mockClear()

    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: false })
    expect(suspendedEmail).not.toHaveBeenCalled()
  })

  it('un admin plateforme agissant pour le bailleur prévient tous ses administrateurs', async () => {
    await adminCaller.bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    expect(suspendedEmail.mock.calls.map(([to]) => to).sort()).toEqual(['admin-a2@test.com', 'owner@test.com'])
  })

  it('journalise la suspension et la reprise', async () => {
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: true })
    await gestCaller().bailleur.setApplicationsSuspended({ slug: 'res-in', suspended: false })

    const actions = (await getTestDb().select().from(activityLog)).map((l) => l.action).sort()
    expect(actions).toEqual(['accommodation.applications_resumed', 'accommodation.applications_suspended'])
  })
})

describe('bailleur.listResidencesWithContactCounts — recherche', () => {
  it('trouve une résidence par son nom ou sa ville, sans tenir compte des accents', async () => {
    await getTestDb().execute(
      sql`update city set name = 'Orléans' where id = (select city_id from accommodation_address where accommodation_id = ${resOut.id} and is_main)`,
    )
    const search = async (term: string) =>
      (await gestCaller().bailleur.listResidencesWithContactCounts({ search: term })).residences.map((r) => r.slug)

    expect(await search('orleans')).toEqual(['res-out'])
    expect(await search('Res In')).toEqual(['res-in'])
    expect(await search('Marseille')).toEqual([])
  })
})

describe('notification d’attribution de la gestion des candidatures', () => {
  it('prévient un gestionnaire créé avec le droit de gestion des candidatures', async () => {
    await ownerCaller.bailleur.users.create({
      email: 'nouveau@a.com',
      firstname: 'Nou',
      lastname: 'Veau',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_applications'],
      applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] },
    })

    expect(grantedEmail).toHaveBeenCalledOnce()
    expect(grantedEmail).toHaveBeenCalledWith(
      'nouveau@a.com',
      expect.objectContaining({ firstname: 'Nou', ownerName: 'Bailleur A', residences: ['Res In'], residencesCount: 1 }),
    )
  })

  it('ne prévient pas un gestionnaire créé sans ce droit', async () => {
    await ownerCaller.bailleur.users.create({
      email: 'residences@a.com',
      firstname: 'Res',
      lastname: 'Only',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences'],
    })

    expect(grantedEmail).not.toHaveBeenCalled()
  })

  it("n'annonce que les résidences ajoutées au périmètre", async () => {
    await restrictTo(GEST.id, [resIn.id])
    await ownerCaller.bailleur.users.update({
      id: GEST.id,
      applicationScope: { mode: 'restricted', accommodationIds: [resIn.id, resOut.id] },
    })

    expect(grantedEmail).toHaveBeenCalledOnce()
    expect(grantedEmail).toHaveBeenCalledWith(GEST.email, expect.objectContaining({ residences: ['Res Out'], residencesCount: 1 }))
  })

  it('annonce toutes les résidences au passage en périmètre complet', async () => {
    await restrictTo(GEST.id, [resIn.id])
    await ownerCaller.bailleur.users.update({ id: GEST.id, applicationScope: { mode: 'all' } })

    expect(grantedEmail).toHaveBeenCalledWith(
      GEST.email,
      expect.objectContaining({ residences: ['Toutes les résidences de Bailleur A'], residencesCount: 2 }),
    )
  })

  it("n'envoie rien quand le périmètre se réduit ou ne change pas", async () => {
    await restrictTo(GEST.id, [resIn.id, resOut.id])
    await ownerCaller.bailleur.users.update({ id: GEST.id, applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] } })
    await ownerCaller.bailleur.users.update({ id: GEST.id, firstname: 'Renomme' })

    expect(grantedEmail).not.toHaveBeenCalled()
  })

  it("prévient à l'octroi du droit depuis l'écran de modération, pas au retrait", async () => {
    await ownerCaller.bailleur.users.setApplicationsPermission({ managers: [{ userId: GEST.id, enabled: false }] })
    expect(grantedEmail).not.toHaveBeenCalled()

    await ownerCaller.bailleur.users.setApplicationsPermission({ managers: [{ userId: GEST.id, enabled: true }] })
    expect(grantedEmail).toHaveBeenCalledOnce()
    expect(grantedEmail).toHaveBeenCalledWith(GEST.email, expect.objectContaining({ residences: ['Toutes les résidences de Bailleur A'] }))
  })

  it("un échec d'envoi ne fait pas échouer la mise à jour", async () => {
    grantedEmail.mockRejectedValueOnce(new Error('Brevo down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await restrictTo(GEST.id, [])

    await expect(ownerCaller.bailleur.users.update({ id: GEST.id, applicationScope: { mode: 'all' } })).resolves.toBeDefined()
    spy.mockRestore()
  })
})
