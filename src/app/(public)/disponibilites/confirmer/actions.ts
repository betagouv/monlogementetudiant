'use server'

import { cookies } from 'next/headers'
import { AVAILABILITY_CONFIRM_COOKIE, confirmFromEmail } from '~/server/bailleur/availability-email-confirmation'

export type TConfirmFromEmailState =
  | null
  | { status: 'success'; confirmed: number; skipped: number }
  | { status: 'failure'; reason: 'invalid' | 'expired' }
  | { status: 'error' }

export async function confirmAvailabilityFromEmail(_previous: TConfirmFromEmailState): Promise<TConfirmFromEmailState> {
  const token = (await cookies()).get(AVAILABILITY_CONFIRM_COOKIE)?.value
  try {
    const result = await confirmFromEmail(token)
    if (!result.ok) return { status: 'failure', reason: result.reason }
    return { status: 'success', confirmed: result.confirmed, skipped: result.skipped }
  } catch (error) {
    console.error('Confirmation des disponibilités depuis l’e-mail échouée', error)
    return { status: 'error' }
  }
}
