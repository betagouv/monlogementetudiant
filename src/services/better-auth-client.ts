import { inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { trackEvent } from '~/lib/tracking'
import type { auth } from '~/services/better-auth'

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), inferAdditionalFields<typeof auth>()],
})

export async function signInCredentials(email: string, password: string, callbackUrl = '/mon-espace') {
  const result = await authClient.signIn.email({ email, password, callbackURL: callbackUrl })

  if (result.error) {
    return { error: result.error.message || 'Authentication failed' }
  }

  return { success: true, callbackUrl, user: result.data?.user }
}

export async function signOut(options: { callbackUrl?: string; redirect?: boolean } = {}) {
  const { callbackUrl = '/', redirect = true } = options
  trackEvent({ category: 'Authentification', action: 'deconnexion' })

  await authClient.signOut()

  if (redirect) {
    window.location.href = callbackUrl
  }

  return { success: true }
}

export type AuthClient = typeof authClient
