import { customSessionClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { auth } from '~/auth'
import { trackEvent } from '~/lib/tracking'

export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
})

export async function signInCredentials(email: string, password: string, callbackUrl = '/mon-espace') {
  const response = await fetch('/api/auth/external-auth/signin/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, callbackUrl }),
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    return { error: data.error || 'Authentication failed' }
  }

  return { success: true, callbackUrl: data.callbackUrl, user: data.user }
}

export async function signOut(options: { callbackUrl?: string; redirect?: boolean } = {}) {
  const { callbackUrl = '/', redirect = true } = options
  trackEvent({ category: 'Authentification', action: 'deconnexion' })

  const response = await fetch('/api/auth/external-auth/signout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callbackUrl }),
  })

  const data = await response.json()

  if (redirect && data.callbackUrl) {
    window.location.href = data.callbackUrl
  }

  return { success: true }
}
