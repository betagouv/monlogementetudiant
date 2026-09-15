import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactSource } from '~/enums/contact-source'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getAccommodationScope, scopeHasAnyAccommodation } from '~/server/bailleur/accommodation-scope'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '../server/db/schema/contacts'
import { dossierFacileApplications } from '../server/db/schema/dossier-facile'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import {
  createAccommodation,
  createDossierFacileApplication,
  createDossierFacileTenant,
  createOwner,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return { ...actual, auth: { ...actual.auth, api: { ...actual.auth.api, signInMagicLink: vi.fn().mockResolvedValue(undefined) } } }
})
vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendContactRequestConfirmationEmail: vi.fn().mockResolvedValue(undefined) }
})

const contactInput = {
  firstname: 'Toto',
  lastname: 'Tutu',
  email: 'tototutu@tete.com',
  phone: '0102030405',
  birthdate: '2003-04-15',
  scholarshipStatus: 'yes',
} as const

const SCOPED = { id: 'gest-scoped', email: 'scoped@a.com' }
const FREE = { id: 'gest-free', email: 'free@a.com' }

const scopedCaller = () => gestionnaireCallerFactory({ ...SCOPED, permissions: ['manage_applications'] })
const freeCaller = () => gestionnaireCallerFactory({ ...FREE, ownerSuffix: 'f', permissions: ['manage_applications'] })

let ownerAId: number
let resIn: { id: number; slug: string }
let resOut: { id: number; slug: string }

/** Restreint un gestionnaire aux résidences données. Tableau vide = aucune résidence. */
const restrictTo = async (userId: string, accommodationIds: number[]) => {
  const db = getTestDb()
  await db.update(user).set({ applicationScopeRestricted: true }).where(eq(user.id, userId))
  await db.delete(bailleurAccommodationScopes).where(eq(bailleurAccommodationScopes.userId, userId))
  if (accommodationIds.length > 0) {
    await db.insert(bailleurAccommodationScopes).values(accommodationIds.map((accommodationId) => ({ userId, accommodationId })))
  }
}

/** Il n'existe pas de factory : on passe par la procédure publique puis on confirme l'adresse. */
const confirmedContact = async (slug: string, email = contactInput.email) => {
  const request = await caller.contacts.create({ accommodationSlug: slug, ...contactInput, email })
  await getTestDb().update(contactRequests).set({ confirmedAt: new Date() }).where(eq(contactRequests.id, request!.id))
  return request!
}

const setContactMode = (mode: EOwnerContactMode) => getTestDb().update(owners).set({ contactMode: mode }).where(eq(owners.id, ownerAId))

beforeEach(async () => {
  const db = getTestDb()
  // `activity_log` n'est pas tronquée par `cleanTables` : sans purge, les ids d'owner repartant de 1,
  // les entrées d'un test précédent seraient relues ici.
  await db.delete(activityLog)

  await createUser({ id: 'test-user-id', name: 'Etudiant', email: 'etudiant@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
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

  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerA.id }).where(eq(user.id, 'test-owner-id'))
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerB.id }).where(eq(user.id, 'test-owner-id-2'))

  resIn = await createAccommodation({ slug: 'res-in', name: 'Res In', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  resOut = await createAccommodation({ slug: 'res-out', name: 'Res Out', ownerId: ownerA.id }, [typologyDraft('t1', { nbAvailable: 5 })])
  await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId: ownerB.id }, [typologyDraft('t1', { nbAvailable: 5 })])

  for (const g of [SCOPED, FREE]) {
    await createUser({ id: g.id, name: 'Gestionnaire', firstname: 'Gest', lastname: g.id, email: g.email, role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: ownerA.id, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'] })
      .where(eq(user.id, g.id))
  }
})

describe('périmètre — résolution', () => {
  it('rend `all` par défaut, pour un gestionnaire sans drapeau', async () => {
    const scope = await getAccommodationScope(SCOPED.id)
    expect(scope.kind).toBe('all')
    expect(scopeHasAnyAccommodation(scope)).toBe(true)
  })

  it('rend `restricted` non vide quand le drapeau est posé', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    const scope = await getAccommodationScope(SCOPED.id)
    expect(scope).toMatchObject({ kind: 'restricted', accommodationIds: [resIn.id], accommodationSlugs: ['res-in'] })
    expect(scopeHasAnyAccommodation(scope)).toBe(true)
  })

  it('rend `restricted` vide — « aucune résidence » et non « toutes »', async () => {
    await restrictTo(SCOPED.id, [])
    const scope = await getAccommodationScope(SCOPED.id)
    expect(scope).toMatchObject({ kind: 'restricted', accommodationIds: [] })
    expect(scopeHasAnyAccommodation(scope)).toBe(false)
  })

  it("ignore une ligne pointant hors du parc du bailleur de l'utilisateur", async () => {
    const resB = await getTestDb().query.accommodations.findFirst({ where: eq(accommodations.slug, 'res-b') })
    await restrictTo(SCOPED.id, [resIn.id, resB!.id])

    const scope = await getAccommodationScope(SCOPED.id)
    expect(scope).toMatchObject({ kind: 'restricted', accommodationIds: [resIn.id] })
  })

  it('un administrateur bailleur reste non restreint même avec un drapeau et des lignes', async () => {
    await restrictTo('test-owner-id', [])
    expect((await getAccommodationScope('test-owner-id')).kind).toBe('all')
  })

  it('un admin plateforme reste non restreint', async () => {
    await restrictTo('test-admin-id', [])
    expect((await getAccommodationScope('test-admin-id')).kind).toBe('all')
  })
})

describe('périmètre — lecture, mode contacts', () => {
  it('la grille ne montre que les résidences du périmètre', async () => {
    await restrictTo(SCOPED.id, [resIn.id])

    const restricted = await scopedCaller().bailleur.listResidencesWithContactCounts({})
    expect(restricted.residences.map((r) => r.slug)).toEqual(['res-in'])

    const free = await freeCaller().bailleur.listResidencesWithContactCounts({})
    expect(free.residences.map((r) => r.slug).sort()).toEqual(['res-in', 'res-out'])
  })

  it('les compteurs « à rappeler » ignorent les résidences hors périmètre', async () => {
    await confirmedContact('res-out')
    await restrictTo(SCOPED.id, [resIn.id])

    const result = await scopedCaller().bailleur.listResidencesWithContactCounts({})
    expect(result.residences).toHaveLength(1)
    expect(result.residences[0].aRappelerCount).toBe(0)
  })

  it('ni la recherche ni le paramètre ownerId ne contournent le périmètre', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    const call = scopedCaller().bailleur

    expect((await call.listResidencesWithContactCounts({ search: 'Res' })).residences.map((r) => r.slug)).toEqual(['res-in'])
    expect((await call.listResidencesWithContactCounts({ ownerId: 999 })).residences.map((r) => r.slug)).toEqual(['res-in'])
  })

  it('le kanban d une résidence hors périmètre est inaccessible', async () => {
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(scopedCaller().bailleur.listContactsByResidence({ slug: 'res-out' })).rejects.toThrow()
    await expect(scopedCaller().bailleur.listContactsByResidence({ slug: 'res-in' })).resolves.toBeDefined()
  })

  it('le détail d un contact hors périmètre est inaccessible', async () => {
    const request = await confirmedContact('res-out')
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(scopedCaller().bailleur.getContact({ id: request.id })).rejects.toThrow()
  })

  it('le changement de statut hors périmètre échoue et ne modifie rien', async () => {
    const request = await confirmedContact('res-out')
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(
      scopedCaller().bailleur.updateContactStatus({ id: request.id, status: EContactStatus.CONTACTE, source: EContactSource.CONTACT }),
    ).rejects.toThrow()

    const [row] = await getTestDb().select().from(contactRequests).where(eq(contactRequests.id, request.id))
    expect(row.status).not.toBe(EContactStatus.CONTACTE)
  })
})

describe('périmètre — lecture, mode DossierFacile', () => {
  const seedApplication = async (slug: string, tenantId: string, userId = 'test-user-id') => {
    const tenant = await createDossierFacileTenant({
      userId,
      tenantId,
      status: 'verified',
      pdfUrl: 'https://df.example.com/doc.pdf',
      url: 'https://df.example.com/tenant',
    })
    const application = await createDossierFacileApplication({
      tenantId: tenant.id,
      accommodationSlug: slug,
      apartmentType: 't1',
      status: EContactStatus.A_CONTACTER,
    })
    return { tenant, application }
  }

  beforeEach(async () => {
    await setContactMode(EOwnerContactMode.DOSSIER_FACILE)
  })

  it('getCandidature refuse une candidature hors périmètre', async () => {
    const { application } = await seedApplication('res-out', 'df-out')
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(scopedCaller().bailleur.getCandidature({ id: application.id })).rejects.toThrow()
  })

  it('listCandidatures n énumère que les résidences du périmètre', async () => {
    await seedApplication('res-in', 'df-in')
    await seedApplication('res-out', 'df-out', 'test-user-id')
    await restrictTo(SCOPED.id, [resIn.id])

    const result = await scopedCaller().bailleur.listCandidatures({ page: 1 })
    expect(result.items.every((i) => i.accommodationSlug === 'res-in')).toBe(true)
  })

  it('getDocumentSignedUrl refuse un dossier hors périmètre', async () => {
    const { tenant } = await seedApplication('res-out', 'df-out')
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(scopedCaller().bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).rejects.toThrow()
  })

  it('reste déterministe quand un locataire a candidaté dans ET hors du périmètre', async () => {
    const tenant = await createDossierFacileTenant({
      userId: 'test-user-id',
      tenantId: 'df-both',
      status: 'verified',
      pdfUrl: 'https://df.example.com/doc.pdf',
    })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: 'res-in', apartmentType: 't1' })
    const outside = await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: 'res-out', apartmentType: 't1' })
    await restrictTo(SCOPED.id, [resIn.id])

    // `findFirst` n'est pas ordonné : sans filtre dans le `where`, un appel sur deux échouerait.
    for (let i = 0; i < 5; i++) {
      await expect(scopedCaller().bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).resolves.toBeDefined()
    }

    // Seule la candidature hors périmètre subsiste dans la fenêtre de rétention.
    await getTestDb()
      .update(dossierFacileApplications)
      .set({ createdAt: sql`now() - '40 days'::interval` })
      .where(eq(dossierFacileApplications.accommodationSlug, 'res-in'))
    expect(outside).toBeDefined()

    for (let i = 0; i < 5; i++) {
      await expect(scopedCaller().bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).rejects.toThrow()
    }
  })
})

describe('périmètre vide', () => {
  beforeEach(async () => {
    await restrictTo(SCOPED.id, [])
  })

  it('ne montre aucune résidence', async () => {
    const result = await scopedCaller().bailleur.listResidencesWithContactCounts({})
    expect(result.residences).toEqual([])
  })

  it('refuse toute résidence, même du bon bailleur', async () => {
    await expect(scopedCaller().bailleur.listContactsByResidence({ slug: 'res-in' })).rejects.toThrow()
  })

  it('interdit de changer le parcours de candidature du bailleur', async () => {
    await expect(scopedCaller().bailleur.setContactMode({ mode: EOwnerContactMode.DOSSIER_FACILE })).rejects.toThrow(/périmètre/)
  })

  it('un gestionnaire au périmètre non vide peut toujours changer le parcours', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await expect(scopedCaller().bailleur.setContactMode({ mode: EOwnerContactMode.DOSSIER_FACILE })).resolves.toMatchObject({
      contactMode: EOwnerContactMode.DOSSIER_FACILE,
    })
  })
})

describe('résidence créée après coup', () => {
  it('est visible du non-restreint et invisible du restreint', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await createAccommodation({ slug: 'res-new', name: 'Res New', ownerId: ownerAId }, [typologyDraft('t1', { nbAvailable: 2 })])

    expect((await scopedCaller().bailleur.listResidencesWithContactCounts({})).residences.map((r) => r.slug)).toEqual(['res-in'])
    expect((await freeCaller().bailleur.listResidencesWithContactCounts({})).residences.map((r) => r.slug)).toContain('res-new')
  })
})

describe('bailleur.users — écriture du périmètre', () => {
  const scopeRows = (userId: string) =>
    getTestDb().select().from(bailleurAccommodationScopes).where(eq(bailleurAccommodationScopes.userId, userId))

  it('crée un gestionnaire directement restreint', async () => {
    const created = await ownerCaller.bailleur.users.create({
      email: 'nouveau@a.com',
      firstname: 'Nou',
      lastname: 'Veau',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_applications'],
      applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] },
    })

    expect(await scopeRows(created.id)).toHaveLength(1)
    expect((await getAccommodationScope(created.id)).kind).toBe('restricted')
  })

  it('une mise à jour sans applicationScope ne touche pas au périmètre', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await ownerCaller.bailleur.users.update({ id: SCOPED.id, firstname: 'Renomme' })

    expect(await scopeRows(SCOPED.id)).toHaveLength(1)
  })

  it('repasser en « toutes » efface le drapeau et les lignes', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await ownerCaller.bailleur.users.update({ id: SCOPED.id, applicationScope: { mode: 'all' } })

    expect(await scopeRows(SCOPED.id)).toHaveLength(0)
    expect((await getAccommodationScope(SCOPED.id)).kind).toBe('all')
  })

  it('accepte une sélection vide, qui produit « aucune résidence »', async () => {
    await ownerCaller.bailleur.users.update({ id: SCOPED.id, applicationScope: { mode: 'restricted', accommodationIds: [] } })

    expect(scopeHasAnyAccommodation(await getAccommodationScope(SCOPED.id))).toBe(false)
  })

  it("refuse une résidence d'un autre bailleur sans rien écrire", async () => {
    const resB = await getTestDb().query.accommodations.findFirst({ where: eq(accommodations.slug, 'res-b') })

    await expect(
      ownerCaller.bailleur.users.update({
        id: SCOPED.id,
        applicationScope: { mode: 'restricted', accommodationIds: [resIn.id, resB!.id] },
      }),
    ).rejects.toThrow(/n'appartient pas/)

    expect(await scopeRows(SCOPED.id)).toHaveLength(0)
  })

  it('refuse les doublons', async () => {
    await expect(
      ownerCaller.bailleur.users.update({
        id: SCOPED.id,
        applicationScope: { mode: 'restricted', accommodationIds: [resIn.id, resIn.id] },
      }),
    ).rejects.toThrow(/plusieurs fois/)
    expect(await scopeRows(SCOPED.id)).toHaveLength(0)
  })

  it('refuse un périmètre restreint sur un administrateur', async () => {
    await expect(
      ownerCaller.bailleur.users.update({
        id: SCOPED.id,
        bailleurRole: 'administrator',
        applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] },
      }),
    ).rejects.toThrow()
  })

  it('une promotion en administrateur efface le périmètre', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await ownerCaller.bailleur.users.update({ id: SCOPED.id, bailleurRole: 'administrator' })

    expect(await scopeRows(SCOPED.id)).toHaveLength(0)
  })

  it('supprimer le gestionnaire supprime ses lignes (cascade)', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await ownerCaller.bailleur.users.delete({ id: SCOPED.id })

    expect(await scopeRows(SCOPED.id)).toHaveLength(0)
  })

  it('supprimer la seule résidence du périmètre donne « aucune », pas « toutes »', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    await getTestDb().delete(contactRequests).where(eq(contactRequests.accommodationId, resIn.id))
    await getTestDb().execute(sql`delete from accommodation where id = ${resIn.id}`)

    expect(scopeHasAnyAccommodation(await getAccommodationScope(SCOPED.id))).toBe(false)
  })

  it('retirer puis rendre manage_applications ne détruit pas le périmètre', async () => {
    // Il lui faut une autre autorisation, sinon le retrait rendrait son compte inerte.
    await getTestDb()
      .update(user)
      .set({ bailleurPermissions: ['manage_residences', 'manage_applications'] })
      .where(eq(user.id, SCOPED.id))
    await restrictTo(SCOPED.id, [resIn.id])
    await ownerCaller.bailleur.users.setApplicationsPermission({ managers: [{ userId: SCOPED.id, enabled: false }] })
    await ownerCaller.bailleur.users.setApplicationsPermission({ managers: [{ userId: SCOPED.id, enabled: true }] })

    expect(await scopeRows(SCOPED.id)).toHaveLength(1)
  })

  it('journalise le changement de périmètre, une seule fois', async () => {
    const readLogs = () =>
      getTestDb()
        .select()
        .from(activityLog)
        .where(and(eq(activityLog.action, 'owner.user_application_scope_updated'), eq(activityLog.ownerId, ownerAId)))

    await ownerCaller.bailleur.users.update({ id: SCOPED.id, applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] } })
    expect(await readLogs()).toHaveLength(1)

    // Réenregistrer à l'identique ne doit rien ajouter.
    await ownerCaller.bailleur.users.update({ id: SCOPED.id, applicationScope: { mode: 'restricted', accommodationIds: [resIn.id] } })
    expect(await readLogs()).toHaveLength(1)
  })

  it('users.list remonte le compte de résidences, null quand non restreint', async () => {
    await restrictTo(SCOPED.id, [resIn.id, resOut.id])
    const { items } = await ownerCaller.bailleur.users.list({})

    expect(items.find((i) => i.id === SCOPED.id)?.applicationScopeCount).toBe(2)
    expect(items.find((i) => i.id === FREE.id)?.applicationScopeCount).toBeNull()
  })

  it('users.getById remonte le périmètre avec les libellés', async () => {
    await restrictTo(SCOPED.id, [resIn.id])
    const target = await ownerCaller.bailleur.users.getById({ id: SCOPED.id })

    expect(target.applicationScope).toMatchObject({ mode: 'restricted', accommodations: [{ id: resIn.id, name: 'Res In' }] })
  })
})

describe('bailleur.listOwnerResidences', () => {
  it('ne renvoie que le parc du bailleur', async () => {
    const { items, truncated } = await ownerCaller.bailleur.listOwnerResidences({})

    expect(items.map((i) => i.name).sort()).toEqual(['Res In', 'Res Out'])
    expect(truncated).toBe(false)
  })

  it('est bornée au périmètre du gestionnaire', async () => {
    await restrictTo(SCOPED.id, [resIn.id])

    const { items } = await scopedCaller().bailleur.listOwnerResidences({})
    expect(items.map((i) => i.name)).toEqual(['Res In'])
  })
})

describe('setContactMode — résidences éligibles', () => {
  const openIds = async () => {
    const rows = await getTestDb().select().from(accommodations).where(eq(accommodations.ownerId, ownerAId))
    return rows
      .filter((r) => r.acceptsApplications)
      .map((r) => r.id)
      .sort()
  }

  it('« toutes » rouvre tout le parc', async () => {
    await getTestDb().update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, resOut.id))

    await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS, residences: { mode: 'all' } })

    expect(await openIds()).toEqual([resIn.id, resOut.id].sort())
  })

  it('une sélection ferme les résidences non cochées', async () => {
    await ownerCaller.bailleur.setContactMode({
      mode: EOwnerContactMode.CONTACTS,
      residences: { mode: 'restricted', accommodationIds: [resIn.id] },
    })

    expect(await openIds()).toEqual([resIn.id])
  })

  it('sans le champ, le parc est laissé tel quel', async () => {
    await getTestDb().update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, resOut.id))

    await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })

    expect(await openIds()).toEqual([resIn.id])
  })

  it('un gestionnaire restreint ne ferme pas les résidences hors de son périmètre', async () => {
    await restrictTo(SCOPED.id, [resIn.id])

    await scopedCaller().bailleur.setContactMode({
      mode: EOwnerContactMode.CONTACTS,
      residences: { mode: 'restricted', accommodationIds: [] },
    })

    // `res-in` fermée (dans son périmètre), `res-out` intacte (hors périmètre).
    expect(await openIds()).toEqual([resOut.id])
  })

  it('refuse une résidence hors du périmètre de l appelant', async () => {
    await restrictTo(SCOPED.id, [resIn.id])

    await expect(
      scopedCaller().bailleur.setContactMode({
        mode: EOwnerContactMode.CONTACTS,
        residences: { mode: 'restricted', accommodationIds: [resOut.id] },
      }),
    ).rejects.toThrow(/pas accessible/)
  })

  it('journalise le changement de résidences éligibles', async () => {
    await ownerCaller.bailleur.setContactMode({
      mode: EOwnerContactMode.CONTACTS,
      residences: { mode: 'restricted', accommodationIds: [resIn.id] },
    })

    const rows = await getTestDb()
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.action, 'owner.application_residences_updated'), eq(activityLog.ownerId, ownerAId)))
    expect(rows).toHaveLength(1)
  })
})

describe('administrateurs et admin plateforme', () => {
  it('un administrateur bailleur voit tout', async () => {
    await restrictTo('test-owner-id', [])
    const result = await ownerCaller.bailleur.listResidencesWithContactCounts({})
    expect(result.residences.map((r) => r.slug).sort()).toEqual(['res-in', 'res-out'])
  })

  it('un admin plateforme voit tout', async () => {
    await restrictTo('test-admin-id', [])
    await expect(adminCaller.bailleur.listCandidatures({ page: 1 })).resolves.toBeDefined()
  })
})

describe('éligibilité par résidence', () => {
  const closeResidence = (id: number) =>
    getTestDb().update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, id))

  it('une résidence fermée refuse les demandes de contact', async () => {
    await closeResidence(resOut.id)

    await expect(caller.contacts.create({ accommodationSlug: 'res-out', ...contactInput })).rejects.toThrow(/n'accepte pas/)
    await expect(caller.contacts.create({ accommodationSlug: 'res-in', ...contactInput })).resolves.toBeDefined()
  })

  it('une résidence fermée refuse les candidatures DossierFacile', async () => {
    await setContactMode(EOwnerContactMode.DOSSIER_FACILE)
    await closeResidence(resOut.id)
    await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-elig', status: 'verified' })

    await expect(authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-out', apartmentType: 't1' })).rejects.toThrow(
      /n'accepte pas/,
    )
  })

  it("refuse une candidature DossierFacile quand le bailleur n'est pas dans ce parcours", async () => {
    // Le parcours du bailleur n'était pas vérifié côté étudiant.
    await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-mode', status: 'verified' })

    await expect(authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-in', apartmentType: 't1' })).rejects.toThrow(
      /DossierFacile/,
    )
  })

  it('la grille du gestionnaire masque les résidences fermées', async () => {
    await closeResidence(resOut.id)

    const result = await freeCaller().bailleur.listResidencesWithContactCounts({})
    expect(result.residences.map((r) => r.slug)).toEqual(['res-in'])
  })

  it('la page publique présente une résidence fermée comme sans parcours', async () => {
    await closeResidence(resOut.id)
    // La route publique exige une géométrie sur l'adresse principale, que la factory ne pose pas.
    await getTestDb().execute(
      sql`update accommodation_address set geom = ST_SetSRID(ST_MakePoint(4.39, 45.43), 4326) where accommodation_id in (${resIn.id}, ${resOut.id})`,
    )

    const open = await caller.accommodations.getBySlug({ slug: 'res-in' })
    const closed = await caller.accommodations.getBySlug({ slug: 'res-out' })

    expect(open.owner?.contactMode).toBe(EOwnerContactMode.CONTACTS)
    expect(closed.owner?.contactMode).toBe(EOwnerContactMode.NONE)
  })

  it('les résidences existantes restent ouvertes par défaut', async () => {
    const created = await createAccommodation({ slug: 'res-default', name: 'Res Default', ownerId: ownerAId }, [
      typologyDraft('t1', { nbAvailable: 1 }),
    ])
    const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.id, created.id))

    expect(row.acceptsApplications).toBe(true)
  })
})
