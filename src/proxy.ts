import { getCookieCache } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_TOKEN_EXPIRATION } from '~/auth'

import { AvailableLocales } from '~/i18n/request'
import { devLog } from '~/lib/dev-log'

const REFRESH_BUFFER_MS = (ACCESS_TOKEN_EXPIRATION - 2 * 60) * 1000 // 2 minutes before expiration

const inflightRefreshes = new Map<string, Promise<{ access: string; refresh: string } | null>>()
const REFRESH_TTL_MS = 30_000

const AUTHENTICATED_ROUTES = [
  // Pages
  '/bailleur',
  '/mon-espace',
  // API routes using access token
  '/api/accommodations/my',
]

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}

function refreshTokenDeduped(refreshToken: string): Promise<{ access: string; refresh: string } | null> {
  const existing = inflightRefreshes.get(refreshToken)
  if (existing) {
    devLog('[proxy] Reusing in-flight refresh for token (deduped)')
    return existing
  }

  const promise = fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) {
        devLog('[proxy] Django refresh failed:', `${response.status} ${response.statusText}`)
        devLog('[proxy] Django refresh response:', await response.json())
        return null
      }
      const data = await response.json()
      return { access: data.access as string, refresh: (data.refresh ?? refreshToken) as string }
    })
    .catch((error) => {
      devLog('[proxy] Django refresh fetch error:', error)
      return null
    })
    .finally(() => {
      inflightRefreshes.delete(refreshToken)
    })

  inflightRefreshes.set(refreshToken, promise)

  // Safety net: evict stale entries in case .finally() never fires (hung fetch)
  setTimeout(() => {
    inflightRefreshes.delete(refreshToken)
  }, REFRESH_TTL_MS)

  return promise
}

export async function proxy(request: NextRequest) {
  const res = NextResponse.next()

  const localeCookie = request.cookies.get('NEXT_LOCALE')
  if (!localeCookie) {
    res.cookies.set('NEXT_LOCALE', AvailableLocales.FR, { maxAge: 365 * 24 * 60 * 60 })
  }

  const pathname = request.nextUrl.pathname
  const needsRefresh = AUTHENTICATED_ROUTES.some((route) => pathname.startsWith(route))
  if (!needsRefresh) {
    return res
  }

  // Guard against infinite redirect loop: after a successful refresh+redirect,
  // clock skew between Django and this server can make the new token still
  // appear expired, re-triggering a refresh. Skip if we just refreshed.
  if (request.cookies.has('__session_refreshed')) {
    devLog('[proxy] Skipping refresh (just redirected)')
    res.cookies.delete('__session_refreshed')
    return res
  }

  devLog('[proxy] Checking session for token refresh')
  const session = await getCookieCache(request.headers, {
    cookiePrefix: 'better-auth',
    secret: process.env.AUTH_SECRET,
    strategy: 'jwe',
  })

  if (!session) {
    devLog('[proxy] No session found, skipping refresh')
    return res
  }

  const sessionData = session.session as typeof session.session & {
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    role: 'owner' | 'user' | 'admin'
  }

  const now = Date.now()
  devLog('[proxy] Session found', sessionData)

  if (!sessionData.accessTokenExpires || now < sessionData.accessTokenExpires - REFRESH_BUFFER_MS) {
    devLog('[proxy] Token still valid, skipping refresh', sessionData)
    return res
  }

  devLog('[proxy] Token expiring soon, attempting refresh')
  try {
    const refreshResult = await refreshTokenDeduped(sessionData.refreshToken)

    if (!refreshResult) {
      devLog('[proxy] Refresh token rejected, clearing session and redirecting to home')
      const redirectRes = NextResponse.redirect(new URL('/', request.url))
      redirectRes.cookies.set('better-auth.session_token', '', { maxAge: 0, path: '/' })
      return redirectRes
    }

    const newAccessToken = refreshResult.access
    const newRefreshToken = refreshResult.refresh

    const payload = JSON.parse(atob(newAccessToken.split('.')[1]))
    const newExpires = payload.exp * 1000

    devLog('[proxy] Django refresh successful', {
      newExpires: new Date(newExpires).toISOString(),
      refreshTokenUpdated: newRefreshToken !== sessionData.refreshToken,
    })

    // 2. Call Better Auth plugin endpoint to update session & cookies
    const baseUrl = process.env.BASE_URL!
    const updateResponse = await fetch(`${baseUrl}/api/auth/external-auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessTokenExpires: newExpires,
      }),
    })

    if (!updateResponse.ok) {
      devLog('[proxy] Session update failed:', `${updateResponse.status} ${updateResponse.statusText}`)
      return res
    }

    // 3. Propagate refreshed cookies
    // For page navigations, redirect to force browser to re-request with new cookies.
    // This avoids the race condition where Server Components run with stale request cookies.
    // API routes keep current behavior (Set-Cookie on response, client handles it).
    if (!pathname.startsWith('/api/')) {
      const redirectRes = NextResponse.redirect(request.url)
      for (const cookie of updateResponse.headers.getSetCookie()) {
        redirectRes.headers.append('Set-Cookie', cookie)
      }
      // Guard cookie set via raw header append (not cookies.set()) to avoid
      // Next.js ResponseCookies overwriting the Better Auth cookies above.
      redirectRes.headers.append('Set-Cookie', '__session_refreshed=1; Max-Age=60; HttpOnly; Path=/')
      devLog('[proxy] Redirecting to refresh cookies for page navigation')
      return redirectRes
    }

    for (const cookie of updateResponse.headers.getSetCookie()) {
      res.headers.append('Set-Cookie', cookie)
    }

    devLog('[proxy] Session updated via Better Auth endpoint')
    return res
  } catch (error) {
    devLog('[proxy] Error during token refresh:', error)
    return res
  }
}
