import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EReminderType } from '~/enums/reminder-email'
import { reminderEmailItems, reminderEmails } from '~/server/db/schema/reminder-emails'
import { recordReminderEmail } from '~/server/reminders/record-reminder-email'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

afterEach(() => {
  vi.restoreAllMocks()
})

const setup = async () => {
  const owner = await createOwner()
  await createUser({ id: 'gest-id', name: 'Gestionnaire', email: 'gest@test.com', role: 'owner', ownerId: owner.id })
  const first = await createAccommodation({ ownerId: owner.id, name: 'Résidence A' })
  const second = await createAccommodation({ ownerId: owner.id, name: 'Résidence B' })
  return { owner, first, second }
}

describe('recordReminderEmail', () => {
  it("enregistre l'e-mail et une ligne par résidence et motif", async () => {
    const { owner, first, second } = await setup()
    const sentAt = new Date('2026-11-01T08:00:00.000Z')

    await recordReminderEmail({
      messageId: '<msg-1@brevo>',
      type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
      userId: 'gest-id',
      ownerId: owner.id,
      recipientEmail: 'gest@test.com',
      sentAt,
      items: [
        { accommodationId: first.id, reason: 'unprocessed_applications' },
        { accommodationId: second.id, reason: 'stale_availability' },
      ],
    })

    const db = getTestDb()
    const emails = await db.select().from(reminderEmails)
    expect(emails).toHaveLength(1)
    expect(emails[0]).toMatchObject({
      messageId: '<msg-1@brevo>',
      type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
      userId: 'gest-id',
      ownerId: owner.id,
      recipientEmail: 'gest@test.com',
    })
    expect(emails[0].sentAt).toEqual(sentAt)

    const items = await db.select().from(reminderEmailItems).where(eq(reminderEmailItems.reminderEmailId, emails[0].id))
    expect(items.map((i) => [i.accommodationId, i.reason]).sort()).toEqual(
      [
        [first.id, 'unprocessed_applications'],
        [second.id, 'stale_availability'],
      ].sort(),
    )
  })

  it("ne lève pas d'erreur si l'enregistrement échoue", async () => {
    const { owner, first } = await setup()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const record = {
      messageId: '<msg-dup@brevo>',
      type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
      userId: 'gest-id',
      ownerId: owner.id,
      recipientEmail: 'gest@test.com',
      sentAt: new Date(),
      items: [{ accommodationId: first.id, reason: 'stale_availability' as const }],
    }

    await recordReminderEmail(record)
    await expect(recordReminderEmail(record)).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(await getTestDb().select().from(reminderEmails)).toHaveLength(1)
  })
})
