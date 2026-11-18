import { NextResponse } from 'next/server'
import { verifyAvailabilityConfirmToken } from '~/server/bailleur/availability-confirm-token'
import { AVAILABILITY_CONFIRM_COOKIE } from '~/server/bailleur/availability-email-confirmation'
import { env } from '~/server/env'
import { DAY_MS } from '~/utils/time'

const PAGE_PATH = '/disponibilites/confirmer'

/**
 * Lien « Rien n'a changé » des e-mails de disponibilités. Ne confirme rien : le jeton passe en cookie
 * et l'URL de la page en est débarrassée (historique, référent, mesure d'audience). La confirmation
 * n'a lieu qu'au clic sur la page.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('jeton') ?? ''
  const verified = verifyAvailabilityConfirmToken(token)

  if (!verified.ok) {
    const response = NextResponse.redirect(`${env.BASE_URL}${PAGE_PATH}?lien=${verified.reason === 'expired' ? 'expire' : 'invalide'}`)
    response.cookies.delete({ name: AVAILABILITY_CONFIRM_COOKIE, path: PAGE_PATH })
    return response
  }

  const response = NextResponse.redirect(`${env.BASE_URL}${PAGE_PATH}`)
  response.cookies.set(AVAILABILITY_CONFIRM_COOKIE, token, {
    httpOnly: true,
    secure: env.BASE_URL.startsWith('https://'),
    sameSite: 'lax',
    path: PAGE_PATH,
    maxAge: DAY_MS / 1000,
  })
  return response
}
