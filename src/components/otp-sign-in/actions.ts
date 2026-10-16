'use server'

import { headers } from 'next/headers'
import { getSafeVerifyUrl, resolveLoginLinkOutcome } from '~/server/services/login-link-outcome'
import { createLoginOtp } from '~/server/services/login-otp'
import { auth } from '~/services/better-auth'

/** Connecte le navigateur à l'origine de la demande quand son lien a été consommé par un tiers. */
export async function recoverLoginWithBinding(url: string): Promise<{ success: boolean }> {
  const verifyUrl = getSafeVerifyUrl(url)
  if (!verifyUrl) return { success: false }

  const outcome = await resolveLoginLinkOutcome(verifyUrl)
  if (outcome.kind !== 'recover') return { success: false }

  const otp = await createLoginOtp(outcome.email)
  await auth.api.signInEmailOTP({ body: { email: outcome.email, otp }, headers: await headers() })
  return { success: true }
}
