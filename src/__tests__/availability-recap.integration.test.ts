import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { createAvailabilityConfirmToken } from '~/server/bailleur/availability-confirm-token'
import { confirmFromEmail, readEmailConfirmation } from '~/server/bailleur/availability-email-confirmation'
import { runAvailabilityMonthlyRecap } from '~/server/bailleur/availability-recap'
import { DAY_MS } from '~/utils/time'
import { accommodationTypologies } from '../server/db/schema/accommodation-typologies'
import { accommodations } from '../server/db/schema/accommodations'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const { monthlyRecapEmail } = vi.hoisted(() => ({ monthlyRecapEmail: vi.fn().mockResolvedValue(undefined) }))

vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendAvailabilityMonthlyRecapEmail: monthlyRecapEmail }
})

const ADMIN = 'recap-admin'
const GEST = 'recap-gestionnaire'
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

let ownerId: number
let resA: { id: number }
let resB: { id: number }

const stamp = (accommodationId: number, at: Date, by = ADMIN) =>
  getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: at, availabilityUpdatedBy: by })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))

const readTypologies = (accommodationId: number) =>
  getTestDb().select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, accommodationId))

const tokenFor = (userId: string, issuedAt: Date, onlyWarned = false) =>
  createAvailabilityConfirmToken({ userId, ownerId, onlyWarned }, issuedAt)

beforeEach(async () => {
  monthlyRecapEmail.mockClear()
  const db = getTestDb()
  await db.delete(activityLog)

  await createUser({ id: ADMIN, name: 'Alice Admin', firstname: 'Alice', email: 'admin@a.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: ADMIN, contactMode: EOwnerContactMode.NONE })
  ownerId = owner.id
  await db.update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, ADMIN))

  resA = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    typologyDraft('t2', { nbTotal: 5, nbAvailable: 1 }),
  ])
  resB = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId }, [typologyDraft('t1', { nbTotal: 10, nbAvailable: 4 })])
  await createAccommodation({ slug: 'res-vide', name: 'Res vide', ownerId }, [typologyDraft('t1', { nbTotal: 10, nbAvailable: null })])
  await stamp(resA.id, daysAgo(10))
  await stamp(resB.id, daysAgo(12))

  await createUser({ id: GEST, name: 'Gaston Gestion', firstname: 'Gaston', email: 'gest@a.com', role: 'owner' })
  await db
    .update(user)
    .set({ ownerId, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'], applicationScopeRestricted: true })
    .where(eq(user.id, GEST))
  await db.insert(bailleurAccommodationScopes).values({ userId: GEST, accommodationId: resB.id })

  const imported = await createOwner({ name: 'Importé', slug: 'importe', availabilityImported: true, contactMode: EOwnerContactMode.NONE })
  await createUser({ id: 'imported-admin', email: 'imported@a.com', role: 'owner' })
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: imported.id }).where(eq(user.id, 'imported-admin'))
  await createAccommodation({ slug: 'res-importee', name: 'Res importée', ownerId: imported.id }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 3 }),
  ])
})

describe('runAvailabilityMonthlyRecap', () => {
  it('envoie à chaque destinataire ses résidences renseignées, hors bailleurs importés', async () => {
    expect(await runAvailabilityMonthlyRecap()).toEqual({ residences: 2, emails: 2, failures: [] })

    const byEmail = Object.fromEntries(monthlyRecapEmail.mock.calls.map(([email, params]) => [email, params]))
    expect(Object.keys(byEmail).sort()).toEqual(['admin@a.com', 'gest@a.com'])
    expect(byEmail['admin@a.com'].residences.map((r: { name: string }) => r.name)).toEqual(['Res A', 'Res B'])
    expect(byEmail['admin@a.com'].residences[0]).toMatchObject({
      name: 'Res A',
      city: expect.stringMatching(/^Ville Test/),
      nbAvailable: 3,
      lastUpdatedAt: expect.any(Date),
    })
    expect(byEmail['gest@a.com'].residences.map((r: { name: string }) => r.name)).toEqual(['Res B'])
    expect(byEmail['admin@a.com'].confirmUrl).not.toBe(byEmail['gest@a.com'].confirmUrl)
  })

  it('--dry-run n’envoie rien', async () => {
    expect(await runAvailabilityMonthlyRecap({ dryRun: true })).toMatchObject({ residences: 2, emails: 0 })
    expect(monthlyRecapEmail).not.toHaveBeenCalled()
  })
})

describe('« Rien n’a changé » depuis l’e-mail', () => {
  it('confirme les disponibilités du périmètre du destinataire et trace l’origine', async () => {
    const issuedAt = new Date()

    expect(await confirmFromEmail(tokenFor(GEST, issuedAt))).toEqual({ ok: true, confirmed: 1, skipped: 0 })

    expect((await readTypologies(resB.id)).every((t) => t.availabilityUpdatedBy === GEST && t.availabilityUpdatedAt! >= issuedAt)).toBe(
      true,
    )
    expect((await readTypologies(resA.id)).every((t) => t.availabilityUpdatedBy === ADMIN)).toBe(true)
    const [log] = await getTestDb().select().from(activityLog)
    expect(log).toMatchObject({ action: 'accommodation.availability_confirmed', metadata: { slug: 'res-b', via: 'email' } })
  })

  it('n’écrase jamais une mise à jour faite depuis l’espace gestionnaire après l’envoi', async () => {
    const issuedAt = daysAgo(1)
    const managerUpdate = new Date(issuedAt.getTime() + 1000)
    await stamp(resA.id, managerUpdate, GEST)

    expect(await confirmFromEmail(tokenFor(ADMIN, issuedAt))).toEqual({ ok: true, confirmed: 1, skipped: 1 })

    const resATypologies = await readTypologies(resA.id)
    expect(
      resATypologies.every((t) => t.availabilityUpdatedBy === GEST && t.availabilityUpdatedAt?.getTime() === managerUpdate.getTime()),
    ).toBe(true)
    expect((await readTypologies(resB.id)).every((t) => t.availabilityUpdatedBy === ADMIN && t.availabilityUpdatedAt! > issuedAt)).toBe(
      true,
    )
  })

  it('est idempotent : un second clic ne réécrit rien', async () => {
    const token = tokenFor(ADMIN, new Date(Date.now() - 1000))
    await confirmFromEmail(token)
    const [before] = await readTypologies(resA.id)

    expect(await confirmFromEmail(token)).toEqual({ ok: true, confirmed: 0, skipped: 2 })
    expect((await readTypologies(resA.id))[0].availabilityUpdatedAt).toEqual(before.availabilityUpdatedAt)
  })

  it('le lien de l’alerte ne confirme que les résidences en alerte', async () => {
    await getTestDb()
      .update(accommodations)
      .set({ staleAvailabilityWarnedAt: daysAgo(1) })
      .where(eq(accommodations.id, resA.id))

    expect(await confirmFromEmail(tokenFor(ADMIN, new Date(), true))).toEqual({ ok: true, confirmed: 1, skipped: 0 })
    expect((await readTypologies(resB.id)).every((t) => t.availabilityUpdatedBy === ADMIN && t.availabilityUpdatedAt! < daysAgo(11))).toBe(
      true,
    )
  })

  it('affiche le récap sans rien écrire', async () => {
    const result = await readEmailConfirmation(tokenFor(ADMIN, new Date()))

    expect(result).toMatchObject({
      ok: true,
      residences: [
        { name: 'Res A', nbAvailable: 3 },
        { name: 'Res B', nbAvailable: 4 },
      ],
    })
    expect((await readTypologies(resA.id)).every((t) => t.availabilityUpdatedAt! < daysAgo(9))).toBe(true)
  })

  it.each([
    ['banni', { banned: true }],
    ['sans droit sur les résidences', { bailleurPermissions: ['manage_applications' as const] }],
    ['sorti du bailleur', { ownerId: null }],
  ])('refuse un destinataire %s', async (_label, change) => {
    await getTestDb().update(user).set(change).where(eq(user.id, GEST))

    expect(await confirmFromEmail(tokenFor(GEST, new Date()))).toEqual({ ok: false, reason: 'invalid' })
    expect((await readTypologies(resB.id)).every((t) => t.availabilityUpdatedBy === ADMIN)).toBe(true)
  })

  it('distingue un lien expiré d’un lien altéré', async () => {
    expect(await confirmFromEmail(tokenFor(ADMIN, daysAgo(36)))).toEqual({ ok: false, reason: 'expired' })
    expect(await confirmFromEmail(`${tokenFor(ADMIN, new Date())}x`)).toEqual({ ok: false, reason: 'invalid' })
    expect(await confirmFromEmail(undefined)).toEqual({ ok: false, reason: 'invalid' })
  })
})
