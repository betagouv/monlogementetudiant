import { randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '~/server/env'
import { hashLoginToken, MAGIC_LINK_EXPIRES_IN_SECONDS } from '~/server/services/login-attempts'

export const LOGIN_BINDING_COOKIE = 'monlogementetudiant.login_binding'

/**
 * Rattache une demande de lien au navigateur qui l'a faite : seul ce navigateur pourra consommer
 * le lien d'un clic, les autres (scanners de mails, autre appareil) passent par le code.
 */
export async function bindLoginRequestToBrowser(): Promise<string> {
  const cookieStore = await cookies()
  const nonce = cookieStore.get(LOGIN_BINDING_COOKIE)?.value || randomBytes(32).toString('base64url')
  cookieStore.set(LOGIN_BINDING_COOKIE, nonce, {
    httpOnly: true,
    secure: env.NEXT_PUBLIC_APP_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: MAGIC_LINK_EXPIRES_IN_SECONDS,
  })
  return hashLoginToken(nonce)
}

export async function isBoundToThisBrowser(bindingHash: string | null): Promise<boolean> {
  if (!bindingHash) return false
  const nonce = (await cookies()).get(LOGIN_BINDING_COOKIE)?.value
  if (!nonce) return false
  const expected = Buffer.from(bindingHash)
  const actual = Buffer.from(hashLoginToken(nonce))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
