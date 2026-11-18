import type { EReminderType } from '~/enums/reminder-email'
import type { InactivityReason } from '~/server/bailleur/inactivity-rules'
import { db } from '~/server/db'
import { reminderEmailItems, reminderEmails } from '~/server/db/schema/reminder-emails'

export type TReminderRecord = {
  messageId: string
  type: EReminderType
  userId: string
  ownerId: number
  recipientEmail: string
  sentAt: Date
  items: { accommodationId: number; reason: InactivityReason }[]
}

export async function recordReminderEmail(record: TReminderRecord): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [email] = await tx
        .insert(reminderEmails)
        .values({
          messageId: record.messageId,
          type: record.type,
          userId: record.userId,
          ownerId: record.ownerId,
          recipientEmail: record.recipientEmail,
          sentAt: record.sentAt,
        })
        .returning({ id: reminderEmails.id })
      if (record.items.length === 0) return
      await tx.insert(reminderEmailItems).values(
        record.items.map((item) => ({
          reminderEmailId: email.id,
          accommodationId: item.accommodationId,
          reason: item.reason,
        })),
      )
    })
  } catch (error) {
    console.error('Relance non enregistrée', record.messageId, error)
  }
}
