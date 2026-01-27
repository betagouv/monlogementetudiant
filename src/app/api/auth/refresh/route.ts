import { getCookieCache } from 'better-auth/cookies'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const requestHeaders = await headers()

  const session = await getCookieCache(requestHeaders, {
    cookiePrefix: 'better-auth',
    secret: process.env.AUTH_SECRET,
    strategy: 'jwe',
  })

  if (!session) {
    return NextResponse.json({ error: 'No session found' }, { status: 401 })
  }

  const sessionData = session.session as typeof session.session & {
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    role: 'owner' | 'user' | 'admin'
  }

  try {
    // 1. Refresh tokens with Django API (different endpoint for owner vs student)
    const refreshUrl =
      sessionData.role === 'owner'
        ? `${process.env.API_AUTH_BASE_URL}/admin-auth/refresh/`
        : `${process.env.API_URL}/accounts/students/token/refresh/`

    const refreshResponse = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: sessionData.refreshToken }),
    })

    if (!refreshResponse.ok) {
      return NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
    }

    const data = await refreshResponse.json()
    const newAccessToken = data.access
    const newRefreshToken = data.refresh ?? sessionData.refreshToken

    // Extract expiration from JWT payload
    const payload = JSON.parse(atob(newAccessToken.split('.')[1]))
    const newExpires = payload.exp * 1000

    // 2. Update session via Better Auth plugin endpoint
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const updateResponse = await fetch(`${origin}/api/auth/external-auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: requestHeaders.get('cookie') || '',
      },
      body: JSON.stringify({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessTokenExpires: newExpires,
      }),
    })

    if (!updateResponse.ok) {
      return NextResponse.json({ error: 'Session update failed' }, { status: 500 })
    }

    // Forward cookies from plugin endpoint response
    const response = NextResponse.json({
      success: true,
      expiresAt: newExpires,
    })

    // Copy Set-Cookie headers from the internal response
    const setCookieHeader = updateResponse.headers.get('set-cookie')
    if (setCookieHeader) {
      response.headers.set('Set-Cookie', setCookieHeader)
    }

    return response
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
