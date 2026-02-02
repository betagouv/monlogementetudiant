import { getCookieCache } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_TOKEN_EXPIRATION } from '~/auth'

import { AvailableLocales } from '~/i18n/request'
import { devLog } from '~/lib/dev-log'

const REFRESH_BUFFER_MS = (ACCESS_TOKEN_EXPIRATION - 2 * 60) * 1000 // 2 minutes before expiration

const AUTHENTICATED_ROUTES = [
  // Pages
  '/bailleur',
  '/mon-espace',
  // API routes using access token
  '/api/accommodations/my',
  '/api/accommodations/favorites',
]

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
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

  // Guard against redirect loop: skip refresh if we just did one
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
  devLog('[proxy] Session found')

  if (!sessionData.accessTokenExpires || now < sessionData.accessTokenExpires - REFRESH_BUFFER_MS) {
    devLog('[proxy] Token still valid, skipping refresh', sessionData)
    return res
  }

  devLog('[proxy] Token expiring soon, attempting refresh')
  try {
    const refreshResponse = await fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: sessionData.refreshToken }),
    })

    if (!refreshResponse.ok) {
      devLog('[proxy] Django refresh failed:', `${refreshResponse.status} ${refreshResponse.statusText}`)
      devLog('[proxy] Django refresh response:', await refreshResponse.json())
      return res
    }

    const data = await refreshResponse.json()
    const newAccessToken = data.access
    const newRefreshToken = data.refresh ?? sessionData.refreshToken

    const payload = JSON.parse(atob(newAccessToken.split('.')[1]))
    const newExpires = payload.exp * 1000

    devLog('[proxy] Django refresh successful', {
      newExpires: new Date(newExpires).toISOString(),
      refreshTokenUpdated: !!data.refresh,
    })

    // 2. Call Better Auth plugin endpoint to update session & cookies
    const baseUrl = request.nextUrl.origin
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
      const setCookieHeader = updateResponse.headers.get('set-cookie')
      if (setCookieHeader) {
        redirectRes.headers.set('Set-Cookie', setCookieHeader)
      }
      // Guard cookie to prevent redirect loop on the next request
      redirectRes.cookies.set('__session_refreshed', '1', { maxAge: 60, httpOnly: true, path: '/' })
      devLog('[proxy] Redirecting to refresh cookies for page navigation')
      return redirectRes
    }

    const setCookieHeader = updateResponse.headers.get('set-cookie')
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(/,(?=\s*[^;]+=[^;]+)/)
      for (const cookie of cookies) {
        const [nameValue] = cookie.split(';')
        const [name, ...valueParts] = nameValue.split('=')
        const value = valueParts.join('=')
        if (name && value) {
          res.headers.append('Set-Cookie', cookie.trim())
        }
      }
    }

    devLog('[proxy] Session updated via Better Auth endpoint')
    return res
  } catch (error) {
    devLog('[proxy] Error during token refresh:', error)
    return res
  }
}
