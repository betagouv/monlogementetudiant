import { type NextRequest, NextResponse } from 'next/server'
import { env } from '~/server/env'
import { buildStrictCsp, generateNonce } from '~/utils/csp'

/**
 * Pose un nonce par requête et la CSP stricte en Report-Only (voir `~/utils/csp`). Next lit la
 * politique dans l'en-tête de **requête** pour en extraire le nonce et l'appliquer à ses propres scripts ;
 * le layout le relit via `x-nonce` pour les scripts tiers (Matomo, DSFR).
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const csp = buildStrictCsp({ nonce, isDev: process.env.NODE_ENV === 'development', reportUri: env.SENTRY_CSP_REPORT_URI })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy-Report-Only', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy-Report-Only', csp)
  return response
}

export const config = {
  matcher: [
    {
      // Pages uniquement : ni API, ni assets statiques, ni préchargements de `next/link`.
      source: '/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
