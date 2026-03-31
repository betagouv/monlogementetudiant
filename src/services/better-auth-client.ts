import { inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { trackEvent } from '~/lib/tracking'
import type { auth } from '~/services/better-auth'

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), inferAdditionalFields<typeof auth>()],
})

export function getRedirectUrlByRole(role: string | undefined): string {
  if (role === 'owner') return '/bailleur/tableau-de-bord'
  return '/mon-espace'
}

export async function signInCredentials(email: string, password: string) {
  const result = await authClient.signIn.email({ email, password, callbackURL: '/mon-espace' })

  if (result.error) {
    return { error: result.error.message || 'Authentication failed' }
  }

  const redirectUrl = getRedirectUrlByRole(result.data?.user?.role)

  return { success: true, redirectUrl, user: result.data?.user }
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
