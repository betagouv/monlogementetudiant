'use server'

import { headers } from 'next/headers'
import { auth } from '~/services/better-auth'

export async function resendVerificationEmail(email: string) {
  const requestHeaders = await headers()
  await auth.api.sendVerificationEmail({
    body: { email, callbackURL: '/mon-espace' },
    headers: requestHeaders,
  })
  return { success: true }
}
