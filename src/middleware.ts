import { NextRequest, NextResponse } from 'next/server'
import { AvailableLocales } from '~/i18n/request'

export const middleware = (request: NextRequest) => {
  const res = NextResponse.next()
  const localeCookie = request.cookies.get('NEXT_LOCALE')

  if (!localeCookie) {
    res.cookies.set('NEXT_LOCALE', AvailableLocales.FR, { maxAge: 365 * 24 * 60 * 60 })
  }

  return res
}

export const config = {
  matcher: '/((?!_next|favicon.ico).*)',
}
