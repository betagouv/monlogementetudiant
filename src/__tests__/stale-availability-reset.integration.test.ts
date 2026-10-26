import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { confirmFromEmail } from '~/server/bailleur/availability-email-confirmation'
import { runAvailabilityMonthlyRecap } from '~/server/bailleur/availability-recap'
import { runInactivityCheck } from '~/server/bailleur/inactivity-suspension'
import { runStaleAvailabilityReset } from '~/server/bailleur/stale-availability-reset'
import { DAY_MS } from '~/utils/time'
import { accommodationTypologies } from '../server/db/schema/accommodation-typologies'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { ownerCaller } from './helpers/test-caller'

const { resetWarningEmail, resetDoneEmail } = vi.hoisted(() => ({
  resetWarningEmail: vi.fn().mockResolvedValue(undefined),
  resetDoneEmail: vi.fn().mockResolvedValue(undefined),
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
    sendAvailabilityResetWarningEmail: resetWarningEmail,
    sendAvailabilityResetDoneEmail: resetDoneEmail,
    sendAvailabilityMonthlyRecapEmail: vi.fn().mockResolvedValue(undefined),
    sendApplicationsInactivityWarningEmail: vi.fn().mockResolvedValue(undefined),
    sendApplicationsAutoSuspendedEmail: vi.fn().mockResolvedValue(undefined),
  }
})

const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)
const daysAhead = (n: number) => new Date(Date.now() + n * DAY_MS)

let ownerId: number
let res: { id: number; slug: string }

const stampAvailability = (at: Date, accommodationId = res.id) =>
  getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: at, availabilityUpdatedBy: 'test-owner-id' })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))

const readResidence = async (id = res.id) => {
  const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.id, id))
  return row
}

const readTypologies = (id = res.id) =>
  getTestDb().select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, id))

const readActions = async () => (await getTestDb().select().from(activityLog)).map((l) => l.action).sort()

beforeEach(async () => {
  await getTestDb().delete(activityLog)
  resetWarningEmail.mockClear()
  resetDoneEmail.mockClear()
  await createUser({ id: 'test-owner-id', name: 'Test Owner', firstname: 'Alice', email: 'owner@test.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id', contactMode: EOwnerContactMode.NONE })
  ownerId = owner.id
  await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'test-owner-id'))
  res = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId, createdAt: daysAgo(100) }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    typologyDraft('t2', { nbTotal: 5, nbAvailable: 1 }),
  ])
})

describe('runStaleAvailabilityReset — bailleurs sans parcours', () => {
  it('ne fait rien avant 30 jours', async () => {
    await stampAvailability(daysAgo(29))

    expect(await runStaleAvailabilityReset()).toEqual({ warned: 0, reset: 0, cleared: 0, failures: [] })
  })

  it('alerte à 30 jours avec un lien vers les résidences et la date limite, sans toucher aux disponibilités', async () => {
    await stampAvailability(daysAgo(30))
    const now = new Date()

    expect(await runStaleAvailabilityReset({ now })).toMatchObject({ warned: 1, reset: 0 })
    expect((await readResidence()).staleAvailabilityWarnedAt).not.toBeNull()
    expect((await readResidence()).nbAvailableApartments).toBe(3)
    expect(resetWarningEmail).toHaveBeenCalledWith(
      'owner@test.com',
      expect.objectContaining({
        residences: [expect.objectContaining({ name: 'Res A', nbAvailable: 3 })],
        confirmUrl: expect.stringContaining('/api/disponibilites/confirmer?jeton='),
        updateUrl: expect.stringContaining('/bailleur/residences'),
        deadline: new Date(now.getTime() + 7 * DAY_MS),
      }),
      { force: false },
    )
    expect(resetDoneEmail).not.toHaveBeenCalled()
  })

  it('repasse en « non communiquée » 7 jours après l’alerte, sans toucher au reste des typologies', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()

    expect(await runStaleAvailabilityReset({ now: daysAhead(6) })).toMatchObject({ reset: 0 })
    expect(resetDoneEmail).not.toHaveBeenCalled()
    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 1 })
    expect(resetDoneEmail).toHaveBeenCalledExactlyOnceWith(
      'owner@test.com',
      expect.objectContaining({
        ownerName: 'Bailleur A',
        residences: [expect.objectContaining({ name: 'Res A', city: expect.stringMatching(/^Ville Test/) })],
        updateUrl: expect.stringContaining('/bailleur/residences'),
      }),
      { force: false },
    )

    const typologies = await readTypologies()
    expect(typologies.map((t) => [t.type, t.nbTotal, t.nbAvailable, t.availabilityUpdatedAt]).sort()).toEqual([
      ['t1', 10, null, null],
      ['t2', 5, null, null],
    ])
    const row = await readResidence()
    expect(row.nbAvailableApartments).toBeNull()
    expect(row.nbTotalApartments).toBe(15)
    expect(row.staleAvailabilityWarnedAt).toBeNull()
    expect(await readActions()).toEqual(['accommodation.availability_auto_reset', 'accommodation.availability_reset_warned'])
  })

  it('lève l’alerte quand le bailleur confirme ses disponibilités', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()

    await ownerCaller.bailleur.updateAvailability({ slug: res.slug, availability: [{ type: 't1', nbAvailable: 2 }] })

    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 0, cleared: 1 })
    expect((await readResidence()).staleAvailabilityWarnedAt).toBeNull()
  })

  it('compte depuis la création de la résidence quand aucun gestionnaire n’a mis à jour', async () => {
    const recent = await createAccommodation({ slug: 'res-recent', name: 'Res récente', ownerId, createdAt: daysAgo(10) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    ])

    await runStaleAvailabilityReset()

    expect((await readResidence()).staleAvailabilityWarnedAt).not.toBeNull()
    expect((await readResidence(recent.id)).staleAvailabilityWarnedAt).toBeNull()
  })

  it('ignore les bailleurs importés', async () => {
    await getTestDb().update(owners).set({ availabilityImported: true }).where(eq(owners.id, ownerId))

    expect(await runStaleAvailabilityReset()).toMatchObject({ warned: 0 })
  })

  it('laisse 30 jours à compter du début du suivi, même si les disponibilités sont plus anciennes', async () => {
    await stampAvailability(daysAgo(90))
    await getTestDb()
      .update(owners)
      .set({ availabilityTrackedSince: daysAgo(10) })
      .where(eq(owners.id, ownerId))

    expect(await runStaleAvailabilityReset()).toMatchObject({ warned: 0 })
    expect(await runStaleAvailabilityReset({ now: daysAhead(20) })).toMatchObject({ warned: 1, reset: 0 })
    expect(await runStaleAvailabilityReset({ now: daysAhead(27) })).toMatchObject({ reset: 1 })
  })

  it('est idempotent', async () => {
    await runStaleAvailabilityReset()
    expect(await runStaleAvailabilityReset()).toMatchObject({ warned: 0, reset: 0, cleared: 0 })
    expect(resetWarningEmail).toHaveBeenCalledTimes(1)
  })

  it('--dry-run n’écrit rien', async () => {
    expect(await runStaleAvailabilityReset({ dryRun: true })).toMatchObject({ warned: 1 })
    expect((await readResidence()).staleAvailabilityWarnedAt).toBeNull()
    expect(resetWarningEmail).not.toHaveBeenCalled()
  })

  it('--owner ne traite que le bailleur ciblé', async () => {
    const qaOwner = await createOwner({ name: 'Bailleur QA', slug: 'bailleur-qa', contactMode: EOwnerContactMode.NONE })
    const qaResidence = await createAccommodation({ slug: 'res-qa', name: 'Res QA', ownerId: qaOwner.id, createdAt: daysAgo(100) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    ])

    expect(await runStaleAvailabilityReset({ ownerSlug: 'bailleur-qa' })).toMatchObject({ warned: 1 })
    expect((await readResidence()).staleAvailabilityWarnedAt).toBeNull()
    expect((await readResidence(qaResidence.id)).staleAvailabilityWarnedAt).not.toBeNull()
  })
})

describe('runStaleAvailabilityReset — bailleurs avec parcours', () => {
  beforeEach(async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.CONTACTS }).where(eq(owners.id, ownerId))
  })

  it('laisse l’alerte au suivi des candidatures', async () => {
    expect(await runStaleAvailabilityReset()).toMatchObject({ warned: 0 })
    expect(resetWarningEmail).not.toHaveBeenCalled()
  })

  it('réinitialise le jour de la suspension et maintient celle-ci', async () => {
    await runInactivityCheck()
    await runInactivityCheck({ now: daysAhead(7) })
    expect((await readResidence()).applicationsSuspensionReason).toBe('stale_availability')

    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 1 })
    expect(resetDoneEmail).not.toHaveBeenCalled()

    const row = await readResidence()
    expect(row.nbAvailableApartments).toBeNull()
    expect(row.staleAvailabilityWarnedAt).not.toBeNull()
    await runInactivityCheck({ now: daysAhead(8) })
    expect((await readResidence()).applicationsSuspendedAt).not.toBeNull()
  })
})

describe('confirmation des disponibilités depuis l’e-mail', () => {
  beforeEach(async () => {
    await stampAvailability(daysAgo(33))
    await runStaleAvailabilityReset()
  })

  it('liste les résidences en alerte avec leurs disponibilités', async () => {
    expect(await ownerCaller.bailleur.listAvailabilityToConfirm()).toEqual([
      {
        id: res.id,
        slug: 'res-a',
        name: 'Res A',
        city: expect.stringMatching(/^Ville Test/),
        nbAvailable: 3,
        lastUpdatedAt: expect.any(Date),
        typologies: [
          { type: 't1', nbAvailable: 2, nbTotal: 10 },
          { type: 't2', nbAvailable: 1, nbTotal: 5 },
        ],
      },
    ])
  })

  it('« rien n’a changé » horodate les disponibilités, lève l’alerte et évite la réinitialisation', async () => {
    expect(await ownerCaller.bailleur.confirmAvailability()).toEqual({ confirmed: 1, skipped: 0 })

    const typologies = await readTypologies()
    expect(typologies.every((t) => t.nbAvailable !== null && t.availabilityUpdatedBy === 'test-owner-id')).toBe(true)
    expect((await readResidence()).staleAvailabilityWarnedAt).toBeNull()
    expect(await ownerCaller.bailleur.listAvailabilityToConfirm()).toEqual([])
    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 0, warned: 0 })
    expect(await readActions()).toContain('accommodation.availability_confirmed')
  })

  it('lève la suspension automatique « disponibilités »', async () => {
    await getTestDb()
      .update(accommodations)
      .set({ applicationsSuspendedAt: new Date(), applicationsSuspensionReason: 'stale_availability' })
      .where(eq(accommodations.id, res.id))
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.CONTACTS }).where(eq(owners.id, ownerId))

    await ownerCaller.bailleur.confirmAvailability()

    expect((await readResidence()).applicationsSuspendedAt).toBeNull()
  })

  it('ne touche pas aux résidences d’un autre bailleur', async () => {
    const otherOwner = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', contactMode: EOwnerContactMode.NONE })
    const foreign = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId: otherOwner.id, createdAt: daysAgo(100) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    ])
    await runStaleAvailabilityReset()

    await ownerCaller.bailleur.confirmAvailability()

    expect((await readResidence(foreign.id)).staleAvailabilityWarnedAt).not.toBeNull()
  })
})

describe('confirmation de toutes les résidences depuis la liste', () => {
  it('horodate aussi les résidences sans alerte et ignore celles sans disponibilité', async () => {
    const stampedAt = daysAgo(10)
    await stampAvailability(stampedAt)
    const empty = await createAccommodation(
      { slug: 'res-empty', name: 'Res vide', ownerId, createdAt: daysAgo(100), updatedAt: stampedAt },
      [typologyDraft('t1', { nbTotal: 10, nbAvailable: null })],
    )

    expect(await ownerCaller.bailleur.confirmAvailability()).toEqual({ confirmed: 0, skipped: 0 })
    expect(await ownerCaller.bailleur.confirmAvailability({ all: true })).toEqual({ confirmed: 1, skipped: 0 })

    const typologies = await readTypologies()
    expect(typologies.every((t) => t.availabilityUpdatedAt !== null && t.availabilityUpdatedAt > stampedAt)).toBe(true)
    expect((await readResidence()).updatedAt?.getTime()).toBe(typologies[0].availabilityUpdatedAt?.getTime())
    expect((await readTypologies(empty.id)).every((t) => t.availabilityUpdatedAt === null)).toBe(true)
    expect((await readResidence(empty.id)).updatedAt?.getTime()).toBe(stampedAt.getTime())
  })
})

describe('parcours des e-mails de disponibilités', () => {
  const tokenFromWarning = () => {
    const [, params] = resetWarningEmail.mock.calls.at(-1) as [string, { confirmUrl: string }]
    return new URL(params.confirmUrl).searchParams.get('jeton') ?? undefined
  }

  it('l’alerte à J+30 ne liste que les résidences périmées et annonce le passage en « non communiquée » à J+37', async () => {
    await stampAvailability(daysAgo(30))
    const fresh = await createAccommodation({ slug: 'res-fraiche', name: 'Res fraîche', ownerId, createdAt: daysAgo(100) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 4 }),
    ])
    await stampAvailability(daysAgo(3), fresh.id)
    const now = new Date()

    await runStaleAvailabilityReset({ now })

    expect(resetWarningEmail).toHaveBeenCalledExactlyOnceWith(
      'owner@test.com',
      expect.objectContaining({
        residences: [expect.objectContaining({ name: 'Res A' })],
        deadline: new Date(now.getTime() + 7 * DAY_MS),
      }),
      { force: false },
    )
  })

  it('« Rien n’a changé » depuis l’alerte lève celle-ci : rien n’est effacé à J+37 et aucun avis n’est envoyé', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()

    expect(await confirmFromEmail(tokenFromWarning())).toEqual({ ok: true, confirmed: 1, skipped: 0 })
    expect((await readResidence()).staleAvailabilityWarnedAt).toBeNull()

    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 0 })
    expect((await readResidence()).nbAvailableApartments).toBe(3)
    expect(resetDoneEmail).not.toHaveBeenCalled()
  })

  it('une mise à jour depuis l’espace gestionnaire après l’alerte évite l’effacement et l’avis', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()

    await ownerCaller.bailleur.updateAvailability({ slug: res.slug, availability: [{ type: 't1', nbAvailable: 5 }] })

    expect(await runStaleAvailabilityReset({ now: daysAhead(7) })).toMatchObject({ reset: 0 })
    expect(resetDoneEmail).not.toHaveBeenCalled()
  })

  it('à J+37, passe les disponibilités en « non communiquée » (et non à zéro), puis envoie l’avis une seule fois', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()

    await runStaleAvailabilityReset({ now: daysAhead(7) })
    await runStaleAvailabilityReset({ now: daysAhead(8) })

    expect((await readTypologies()).map((t) => t.nbAvailable)).toEqual([null, null])
    expect(resetDoneEmail).toHaveBeenCalledTimes(1)
  })

  it('chaque destinataire de l’avis ne reçoit que les résidences de son périmètre', async () => {
    const resB = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId, createdAt: daysAgo(100) }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 4 }),
    ])
    await stampAvailability(daysAgo(30))
    await stampAvailability(daysAgo(30), resB.id)
    await createUser({ id: 'gest', name: 'Gaston', firstname: 'Gaston', email: 'gest@test.com', role: 'owner' })
    await getTestDb()
      .update(user)
      .set({ ownerId, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'], applicationScopeRestricted: true })
      .where(eq(user.id, 'gest'))
    await getTestDb().insert(bailleurAccommodationScopes).values({ userId: 'gest', accommodationId: resB.id })
    await runStaleAvailabilityReset()

    await runStaleAvailabilityReset({ now: daysAhead(7) })

    const byEmail = Object.fromEntries(
      resetDoneEmail.mock.calls.map(([email, params]) => [email, params.residences.map((r: { name: string }) => r.name)]),
    )
    expect(byEmail).toEqual({ 'owner@test.com': ['Res A', 'Res B'], 'gest@test.com': ['Res B'] })
  })

  it('n’alerte ni n’avertit pour une résidence sans disponibilités renseignées', async () => {
    await getTestDb().update(accommodationTypologies).set({ nbAvailable: null }).where(eq(accommodationTypologies.accommodationId, res.id))

    await runStaleAvailabilityReset()
    await runStaleAvailabilityReset({ now: daysAhead(7) })

    expect(resetWarningEmail).not.toHaveBeenCalled()
    expect(resetDoneEmail).not.toHaveBeenCalled()
  })

  it('une résidence passée en « non communiquée » sort du récap mensuel', async () => {
    await stampAvailability(daysAgo(30))
    await runStaleAvailabilityReset()
    await runStaleAvailabilityReset({ now: daysAhead(7) })

    expect(await runAvailabilityMonthlyRecap({ now: daysAhead(7) })).toMatchObject({ residences: 0, emails: 0 })
  })
})
