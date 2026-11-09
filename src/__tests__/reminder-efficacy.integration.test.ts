import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EReminderType } from '~/enums/reminder-email'
import { loadReminderEfficacy } from '~/server/reminders/load-reminder-efficacy'
import { recordReminderEmail } from '~/server/reminders/record-reminder-email'
import { DAY_MS } from '~/utils/time'
import { activityLog } from '../server/db/schema/activity-log'
import { contactRequests } from '../server/db/schema/contacts'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const USER = 'efficacy-user'
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

let ownerId: number
let resA: { id: number; slug: string }
let resB: { id: number; slug: string }

const logAction = (action: string, slug: string, createdAt: Date, overrides: { ownerId?: number; userId?: string } = {}) =>
  getTestDb()
    .insert(activityLog)
    .values({ action, entityType: 'accommodation', entityName: slug, ownerId, metadata: { slug }, createdAt, ...overrides })

const record = (
  messageId: string,
  type: EReminderType,
  sentAt: Date,
  reason: 'unprocessed_applications' | 'stale_availability',
  res = resA,
) =>
  recordReminderEmail({
    messageId,
    type,
    userId: USER,
    ownerId,
    recipientEmail: 'efficacy@a.com',
    sentAt,
    items: [{ accommodationId: res.id, reason }],
  })

beforeEach(async () => {
  await getTestDb().delete(activityLog)
  await createUser({ id: USER, name: 'Eff Icacy', firstname: 'Eff', email: 'efficacy@a.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur Eff', slug: 'bailleur-eff', userId: USER })
  ownerId = owner.id
  resA = await createAccommodation({ slug: 'eff-res-a', name: 'Res A', ownerId })
  resB = await createAccommodation({ slug: 'eff-res-b', name: 'Res B', ownerId })
})

describe('loadReminderEfficacy', () => {
  it('récap suivi d’une confirmation de disponibilités : effective', async () => {
    await record('m-recap', EReminderType.AVAILABILITY_MONTHLY_RECAP, daysAgo(10), 'stale_availability')
    await logAction('accommodation.availability_confirmed', resA.slug, daysAgo(8))

    const result = await loadReminderEfficacy(['m-recap'])
    expect(result.get('m-recap')).toEqual({ status: 'effective', reactionMs: expect.closeTo(2 * DAY_MS, -3), residencesCount: 1 })
  })

  it('alerte candidatures : effective si la demande est traitée, pending sinon', async () => {
    await record('m-apps', EReminderType.APPLICATIONS_INACTIVITY_WARNING, daysAgo(3), 'unprocessed_applications')
    const [contact] = await getTestDb()
      .insert(contactRequests)
      .values({ accommodationId: resA.id, email: 'etu@a.com', confirmedAt: daysAgo(5), createdAt: daysAgo(4) })
      .returning()

    expect((await loadReminderEfficacy(['m-apps'])).get('m-apps')?.status).toBe('pending')

    await getTestDb()
      .update(contactRequests)
      .set({ reviewedAt: daysAgo(2) })
      .where(eq(contactRequests.id, contact.id))
    expect((await loadReminderEfficacy(['m-apps'])).get('m-apps')?.status).toBe('effective')
  })

  it('alerte disponibilités suivie d’une remise à zéro : failed', async () => {
    await record('m-stale', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(10), 'stale_availability')
    await logAction('accommodation.availability_auto_reset', resA.slug, daysAgo(3))

    expect((await loadReminderEfficacy(['m-stale'])).get('m-stale')?.status).toBe('failed')
  })

  it('action sur une autre résidence : failed une fois l’échéance passée', async () => {
    await record('m-other', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(10), 'stale_availability')
    await logAction('accommodation.availability_updated', resB.slug, daysAgo(8))

    expect((await loadReminderEfficacy(['m-other'])).get('m-other')?.status).toBe('failed')
  })

  it('un événement entre deux envois ne compte que pour le premier e-mail', async () => {
    await record('m-first', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(10), 'stale_availability')
    await record('m-second', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(3), 'stale_availability')
    await logAction('accommodation.availability_confirmed', resA.slug, daysAgo(6))

    const result = await loadReminderEfficacy(['m-first', 'm-second'])
    expect(result.get('m-first')?.status).toBe('effective')
    expect(result.get('m-second')?.status).toBe('pending')
  })

  it('un événement du même slug sur un autre bailleur est ignoré', async () => {
    const other = await createOwner({ name: 'Autre bailleur', slug: 'autre-bailleur' })
    await record('m-owner', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(10), 'stale_availability')
    await logAction('accommodation.availability_confirmed', resA.slug, daysAgo(8), { ownerId: other.id })

    expect((await loadReminderEfficacy(['m-owner'])).get('m-owner')?.status).toBe('failed')
  })

  it('un événement d’un autre utilisateur du même bailleur compte', async () => {
    await createUser({ id: 'efficacy-colleague', name: 'Col Lègue', firstname: 'Col', email: 'colleague@a.com', role: 'owner' })
    await record('m-colleague', EReminderType.AVAILABILITY_RESET_WARNING, daysAgo(10), 'stale_availability')
    await logAction('accommodation.availability_updated', resA.slug, daysAgo(8), { userId: 'efficacy-colleague' })

    expect((await loadReminderEfficacy(['m-colleague'])).get('m-colleague')?.status).toBe('effective')
  })

  describe('candidatures en attente à l’envoi', () => {
    const addContact = (email: string, createdAt: Date, reviewedAt: Date | null = null) =>
      getTestDb().insert(contactRequests).values({ accommodationId: resA.id, email, confirmedAt: createdAt, createdAt, reviewedAt })

    it('deux demandes en attente, une seule traitée : pending puis failed après l’échéance', async () => {
      await addContact('a@a.com', daysAgo(12), daysAgo(1))
      await addContact('b@a.com', daysAgo(12))

      await record('m-two', EReminderType.APPLICATIONS_INACTIVITY_WARNING, daysAgo(3), 'unprocessed_applications')
      expect((await loadReminderEfficacy(['m-two'])).get('m-two')?.status).toBe('pending')

      await record('m-two-old', EReminderType.APPLICATIONS_INACTIVITY_WARNING, daysAgo(10), 'unprocessed_applications')
      expect((await loadReminderEfficacy(['m-two-old'])).get('m-two-old')?.status).toBe('failed')
    })

    it('toutes les demandes traitées : effective, réaction = dernière revue', async () => {
      await record('m-all', EReminderType.APPLICATIONS_INACTIVITY_WARNING, daysAgo(5), 'unprocessed_applications')
      await addContact('a@a.com', daysAgo(6), daysAgo(4))
      await addContact('b@a.com', daysAgo(6), daysAgo(2))

      expect((await loadReminderEfficacy(['m-all'])).get('m-all')).toEqual({
        status: 'effective',
        reactionMs: expect.closeTo(3 * DAY_MS, -3),
        residencesCount: 1,
      })
    })

    it('une demande créée après l’envoi et traitée ne résout pas la paire', async () => {
      await record('m-late', EReminderType.APPLICATIONS_INACTIVITY_WARNING, daysAgo(5), 'unprocessed_applications')
      await addContact('a@a.com', daysAgo(6))
      await addContact('b@a.com', daysAgo(4), daysAgo(3))

      expect((await loadReminderEfficacy(['m-late'])).get('m-late')?.status).toBe('pending')
    })
  })

  it('une résidence citée pour les deux motifs compte une fois', async () => {
    await recordReminderEmail({
      messageId: 'm-both',
      type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
      userId: USER,
      ownerId,
      recipientEmail: 'efficacy@a.com',
      sentAt: daysAgo(2),
      items: [
        { accommodationId: resA.id, reason: 'unprocessed_applications' },
        { accommodationId: resA.id, reason: 'stale_availability' },
      ],
    })
    expect((await loadReminderEfficacy(['m-both'])).get('m-both')?.residencesCount).toBe(1)
  })

  it('messageId inconnu : absent de la Map', async () => {
    expect((await loadReminderEfficacy(['inconnu'])).size).toBe(0)
  })
})
