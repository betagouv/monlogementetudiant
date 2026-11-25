import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { env } from '~/server/env'
import { deleteBrevoContact } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'

export async function deleteUserAccount(userId: string): Promise<{ id: string; email: string } | null> {
  const [deleted] = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id, email: user.email })
  if (!deleted) return null

  await removeBrevoContact(deleted.email)
  return deleted
}

async function removeBrevoContact(email: string): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] suppression du contact Brevo ignorée pour ${maskEmail(email)}`)
    return
  }

  try {
    await deleteBrevoContact(email)
  } catch (error) {
    console.error(`Échec de la suppression du contact Brevo pour ${maskEmail(email)}`, error)
  }
}
