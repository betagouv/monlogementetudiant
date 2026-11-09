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

const logAction = (action: string, slug: string, createdAt: Date) =>
  getTestDb().insert(activityLog).values({ action, entityType: 'accommodation', entityName: slug, ownerId, metadata: { slug }, createdAt })

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
    const [contact] = await getTestDb().insert(contactRequests).values({ accommodationId: resA.id, email: 'etu@a.com' }).returning()

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

  it('messageId inconnu : absent de la Map', async () => {
    expect((await loadReminderEfficacy(['inconnu'])).size).toBe(0)
  })
})
