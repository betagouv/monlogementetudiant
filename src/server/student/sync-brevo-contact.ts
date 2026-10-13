import { env } from '~/server/env'
import { syncBrevoStudentCreated } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'

type CreatedUser = { email: string; role?: string | null; firstname?: string | null; lastname?: string | null }

export async function syncStudentBrevoContactOnSignup(user: CreatedUser): Promise<void> {
  if (user.role !== 'user') return
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] synchronisation Brevo à l'inscription ignorée pour ${maskEmail(user.email)}`)
    return
  }

  try {
    await syncBrevoStudentCreated(user.email, {
      firstname: user.firstname ?? '',
      lastname: user.lastname ?? '',
    })
  } catch (error) {
    console.error('Erreur synchronisation du contact Brevo à l’inscription', error)
  }
}
