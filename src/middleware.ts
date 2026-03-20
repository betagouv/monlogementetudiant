import { NextRequest, NextResponse } from 'next/server'

// MAINTENANCE - Passer à false ou supprimer ce fichier pour désactiver la maintenance
const MAINTENANCE = true
const MAINTENANCE_PATH = '/maintenance'

export function middleware(request: NextRequest) {
  if (!MAINTENANCE) return NextResponse.next()

  const bypass = request.cookies.get('bypass-maintenance')?.value === 'true'
  if (bypass) return NextResponse.next()

  // Bloquer les appels API avec une 503
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Service en maintenance' }, { status: 503 })
  }

  // Rediriger toutes les pages vers /maintenance
  if (request.nextUrl.pathname !== MAINTENANCE_PATH) {
    return NextResponse.redirect(new URL(MAINTENANCE_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|dsfr).*)'],
}
