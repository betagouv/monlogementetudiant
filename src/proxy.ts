import { getCookieCache } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

import { AvailableLocales } from '~/i18n/request'
import { devLog } from '~/lib/dev-log'

const REFRESH_BUFFER_MS = 3 * 60 * 1000 // 3 minutes buffer

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
  // const expiresAt = sessionData.accessTokenExpires
  // const timeUntilExpiry = expiresAt ? expiresAt - now : null
  devLog('[proxy] Session found')
  // devLog('[proxy] Session found', {
  //   role: sessionData.role,
  //   expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'not set',
  //   timeUntilExpiry: timeUntilExpiry ? `${Math.round(timeUntilExpiry / 1000)}s` : 'n/a',
  //   needsRefresh: expiresAt ? now >= expiresAt - REFRESH_BUFFER_MS : false,
  // })

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

    // 3. Copy cookies from the response to the middleware response
    const setCookieHeader = updateResponse.headers.get('set-cookie')
    if (setCookieHeader) {
      // Parse and set each cookie
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
