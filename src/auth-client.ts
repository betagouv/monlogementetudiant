import { customSessionClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { useCallback, useEffect, useRef } from 'react'
import type { auth } from '~/auth'

export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
})

const REFRESH_BUFFER_MS = 2 * 60 * 1000 // 2 minutes before expiry

export async function refreshSession(): Promise<{ success: boolean; expiresAt?: number }> {
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST' })
    if (!response.ok) {
      return { success: false }
    }
    return await response.json()
  } catch {
    return { success: false }
  }
}

export function useSessionRefresh(expiresAt: number | undefined) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (!expiresAt) return

    const now = Date.now()
    const timeUntilRefresh = expiresAt - now - REFRESH_BUFFER_MS

    if (timeUntilRefresh <= 0) {
      refreshSession()
      return
    }

    timeoutRef.current = setTimeout(async () => {
      const result = await refreshSession()
      if (result.success && result.expiresAt) {
        const nextRefresh = result.expiresAt - Date.now() - REFRESH_BUFFER_MS
        if (nextRefresh > 0) {
          timeoutRef.current = setTimeout(() => scheduleRefresh(), nextRefresh)
        }
      }
    }, timeUntilRefresh)
  }, [expiresAt])

  useEffect(() => {
    scheduleRefresh()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [scheduleRefresh])
}

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
