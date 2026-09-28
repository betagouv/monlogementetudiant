import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactSource } from '~/enums/contact-source'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { runInactivityCheck } from '~/server/bailleur/inactivity-suspension'
import { DAY_MS } from '~/utils/time'
import { accommodationTypologies } from '../server/db/schema/accommodation-typologies'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '../server/db/schema/contacts'
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
import { gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

const { warningEmail, suspendedEmail } = vi.hoisted(() => ({
  warningEmail: vi.fn().mockResolvedValue(undefined),
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
    sendApplicationsInactivityWarningEmail: warningEmail,
    sendApplicationsAutoSuspendedEmail: suspendedEmail,
    sendApplicationsSuspendedEmail: vi.fn().mockResolvedValue(undefined),
  }
})

const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)
const daysAhead = (n: number) => new Date(Date.now() + n * DAY_MS)

const GEST_IN = 'gest-in'
const GEST_OUT = 'gest-out'

let ownerId: number
let res: { id: number; slug: string }
let other: { id: number; slug: string }

const readResidence = async (id = res.id) => {
  const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.id, id))
  return row
}

const addPendingContact = async (since: Date, accommodationId = res.id) => {
  const [row] = await getTestDb()
    .insert(contactRequests)
    .values({
      accommodationId,
      firstname: 'Toto',
      lastname: 'Tutu',
      email: `toto-${crypto.randomUUID().slice(0, 6)}@test.com`,
      confirmedAt: since,
      createdAt: since,
      status: EContactStatus.A_CONTACTER,
    })
    .returning()
  return row
}

const stampAvailability = (at: Date, accommodationId = res.id) =>
  getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: at })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))

const readActions = async () => (await getTestDb().select().from(activityLog)).map((l) => l.action).sort()

beforeEach(async () => {
  const db = getTestDb()
  await db.delete(activityLog)
  warningEmail.mockClear()
  suspendedEmail.mockClear()

  await createUser({ id: 'test-owner-id', name: 'Test Owner', firstname: 'Alice', email: 'owner@test.com', role: 'owner' })
  const owner = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'test-owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
  ownerId = owner.id
  await db.update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'test-owner-id'))

  res = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId, createdAt: daysAgo(100) }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
  ])
  other = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId, createdAt: daysAgo(100) }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
  ])
  await stampAvailability(daysAgo(1), res.id)
  await stampAvailability(daysAgo(1), other.id)

  for (const [id, scope] of [
    [GEST_IN, res.id],
    [GEST_OUT, other.id],
  ] as const) {
    await createUser({ id, name: id, firstname: id, email: `${id}@a.com`, role: 'owner' })
    await db
      .update(user)
      .set({ ownerId, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'], applicationScopeRestricted: true })
      .where(eq(user.id, id))
    await db.insert(bailleurAccommodationScopes).values({ userId: id, accommodationId: scope })
  }
})

describe('runInactivityCheck — candidatures non traitées', () => {
  it('alerte au 7e jour, puis suspend au 10e jour, 3 jours après l’alerte', async () => {
    await addPendingContact(daysAgo(7))

    expect(await runInactivityCheck()).toMatchObject({ warned: 1, suspended: 0 })
    expect((await readResidence()).unprocessedApplicationsWarnedAt).not.toBeNull()
    expect(warningEmail).toHaveBeenCalledTimes(2)

    expect(await runInactivityCheck({ now: daysAhead(3) })).toMatchObject({ warned: 0, suspended: 1 })
    const row = await readResidence()
    expect(row.applicationsSuspendedAt).not.toBeNull()
    expect(row.applicationsSuspensionReason).toBe('unprocessed_applications')
    expect(row.applicationsSuspendedById).toBeNull()
    expect(suspendedEmail).toHaveBeenCalledTimes(2)
  })

  it('laisse tout le préavis à une résidence déjà en retard à la première alerte', async () => {
    await addPendingContact(daysAgo(20))

    await runInactivityCheck()
    expect(await runInactivityCheck({ now: daysAhead(1) })).toMatchObject({ suspended: 0 })
    expect(await runInactivityCheck({ now: daysAhead(3) })).toMatchObject({ suspended: 1 })
  })

  it('est idempotent', async () => {
    await addPendingContact(daysAgo(8))

    await runInactivityCheck()
    expect(await runInactivityCheck()).toMatchObject({ warned: 0, suspended: 0, resumed: 0, cleared: 0 })
    expect(warningEmail).toHaveBeenCalledTimes(2)
  })

  it('écrit aux administrateurs et aux gestionnaires du périmètre, une fois par destinataire', async () => {
    await addPendingContact(daysAgo(8))
    await addPendingContact(daysAgo(8), other.id)

    await runInactivityCheck()

    const recipients = warningEmail.mock.calls.map(([email]) => email).sort()
    expect(recipients).toEqual(['gest-in@a.com', 'gest-out@a.com', 'owner@test.com'])
    const adminCall = warningEmail.mock.calls.find(([email]) => email === 'owner@test.com')
    expect(adminCall?.[1].residences).toHaveLength(2)
  })

  it('reprend dès qu’une candidature est traitée, via le board', async () => {
    const contact = await addPendingContact(daysAgo(12))
    await runInactivityCheck({ now: daysAgo(3) })
    await runInactivityCheck()
    expect((await readResidence()).applicationsSuspendedAt).not.toBeNull()

    const gestCaller = gestionnaireCallerFactory({ id: GEST_IN, email: 'gest-in@a.com', permissions: ['manage_applications'] })
    await gestCaller.bailleur.updateContactStatus({ id: contact.id, status: EContactStatus.CONTACTE, source: EContactSource.CONTACT })

    const row = await readResidence()
    expect(row.applicationsSuspendedAt).toBeNull()
    expect(row.applicationsSuspensionReason).toBeNull()
    expect(row.unprocessedApplicationsWarnedAt).toBeNull()
    expect(await readActions()).toContain('accommodation.applications_auto_resumed')
  })

  it('ne reprend jamais une suspension manuelle', async () => {
    await ownerCaller.bailleur.setApplicationsSuspended({ slug: res.slug, suspended: true })

    expect(await runInactivityCheck()).toMatchObject({ resumed: 0 })
    expect((await readResidence()).applicationsSuspensionReason).toBe('manual')
  })

  it('une reprise manuelle réarme le cycle alerte → suspension', async () => {
    await addPendingContact(daysAgo(12))
    await runInactivityCheck({ now: daysAgo(3) })
    await runInactivityCheck()
    await ownerCaller.bailleur.setApplicationsSuspended({ slug: res.slug, suspended: false })

    expect(await runInactivityCheck({ now: daysAhead(1) })).toMatchObject({ warned: 1, suspended: 0 })
  })

  it('suit la colonne « à modérer » en mode DossierFacile', async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.DOSSIER_FACILE }).where(eq(owners.id, ownerId))
    await createUser({ id: 'student', name: 'Etudiant', email: 'etudiant@test.com', role: 'user' })
    const tenant = await createDossierFacileTenant({ userId: 'student', status: 'verified' })
    await createDossierFacileApplication({
      tenantId: tenant.id,
      accommodationSlug: res.slug,
      apartmentType: 't1',
      status: EContactStatus.A_MODERER,
      createdAt: daysAgo(8),
    })
    await addPendingContact(daysAgo(8), other.id)

    expect(await runInactivityCheck()).toMatchObject({ warned: 1 })
    expect((await readResidence()).unprocessedApplicationsWarnedAt).not.toBeNull()
    expect((await readResidence(other.id)).unprocessedApplicationsWarnedAt).toBeNull()
  })

  it('ignore les résidences fermées et les bailleurs sans parcours', async () => {
    await addPendingContact(daysAgo(8))
    await getTestDb().update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, res.id))
    expect(await runInactivityCheck()).toMatchObject({ warned: 0 })

    await getTestDb().update(accommodations).set({ acceptsApplications: true }).where(eq(accommodations.id, res.id))
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.NONE }).where(eq(owners.id, ownerId))
    expect(await runInactivityCheck()).toMatchObject({ warned: 0 })
  })

  it('--dry-run n’écrit rien', async () => {
    await addPendingContact(daysAgo(8))

    expect(await runInactivityCheck({ dryRun: true })).toMatchObject({ warned: 1 })
    expect((await readResidence()).unprocessedApplicationsWarnedAt).toBeNull()
    expect(warningEmail).not.toHaveBeenCalled()
  })

  it('--owner ne traite que le bailleur ciblé et force l’envoi des e-mails', async () => {
    const qaOwner = await createOwner({ name: 'Bailleur QA', slug: 'bailleur-qa', contactMode: EOwnerContactMode.CONTACTS })
    const qaResidence = await createAccommodation({ slug: 'res-qa', name: 'Res QA', ownerId: qaOwner.id, createdAt: daysAgo(100) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    ])
    await stampAvailability(daysAgo(1), qaResidence.id)
    await createUser({ id: 'qa-admin', name: 'QA', firstname: 'QA', email: 'qa@test.com', role: 'owner' })
    await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId: qaOwner.id }).where(eq(user.id, 'qa-admin'))
    await addPendingContact(daysAgo(8))
    await addPendingContact(daysAgo(8), qaResidence.id)

    expect(await runInactivityCheck({ ownerSlug: 'bailleur-qa', sendOutsideProduction: true })).toMatchObject({ warned: 1 })
    expect((await readResidence()).unprocessedApplicationsWarnedAt).toBeNull()
    expect((await readResidence(qaResidence.id)).unprocessedApplicationsWarnedAt).not.toBeNull()
    expect(warningEmail).toHaveBeenCalledTimes(1)
    expect(warningEmail).toHaveBeenCalledWith('qa@test.com', expect.anything(), { force: true })
  })
})

describe('runInactivityCheck — disponibilités', () => {
  it('alerte à 23 jours, suspend à 30 jours, et reprend à la mise à jour', async () => {
    await stampAvailability(daysAgo(23))

    expect(await runInactivityCheck()).toMatchObject({ warned: 1 })
    expect(await runInactivityCheck({ now: daysAhead(7) })).toMatchObject({ suspended: 1 })
    expect((await readResidence()).applicationsSuspensionReason).toBe('stale_availability')

    await ownerCaller.bailleur.updateAvailability({ slug: res.slug, availability: [{ type: 't1', nbAvailable: 2 }] })

    const row = await readResidence()
    expect(row.applicationsSuspendedAt).toBeNull()
    expect(row.staleAvailabilityWarnedAt).toBeNull()
  })

  it('écrit aux gestionnaires qui gèrent les résidences, pas à ceux qui ne gèrent que les candidatures', async () => {
    await stampAvailability(daysAgo(23))

    await runInactivityCheck()

    expect(warningEmail.mock.calls.map(([email]) => email)).toEqual(['owner@test.com'])
  })

  it('ne s’applique pas aux bailleurs importés, qui restent suivis sur les candidatures', async () => {
    await getTestDb().update(owners).set({ availabilityImported: true }).where(eq(owners.id, ownerId))
    await stampAvailability(daysAgo(40))
    await addPendingContact(daysAgo(8))

    await runInactivityCheck()

    const row = await readResidence()
    expect(row.staleAvailabilityWarnedAt).toBeNull()
    expect(row.unprocessedApplicationsWarnedAt).not.toBeNull()
  })
})
