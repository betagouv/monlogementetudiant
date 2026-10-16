import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { env } from '~/server/env'
import { findLoginAttemptByToken } from '~/server/services/login-attempts'
import { isBoundToThisBrowser } from '~/server/services/login-binding'
import { safeCallbackPath } from '~/utils/safe-callback-path'

const MAGIC_LINK_VERIFY_PATH = '/api/auth/magic-link/verify'

const DEFAULT_CALLBACK_BY_ROLE = {
  owner: '/bailleur/tableau-de-bord',
  admin: '/administration/tableau-de-bord',
} as const

type TMagicLinkRole = keyof typeof DEFAULT_CALLBACK_BY_ROLE

const isMagicLinkRole = (role: string | null): role is TMagicLinkRole => role === 'owner' || role === 'admin'

/**
 * Vérifie que l'URL cible est bien l'endpoint de vérification Better Auth de notre
 * propre origine : aucune autre destination de redirection n'est acceptée.
 */
export function getSafeVerifyUrl(url: string | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const base = new URL(env.BASE_URL)
  if (parsed.origin !== base.origin) return null
  if (!parsed.pathname.startsWith(MAGIC_LINK_VERIFY_PATH)) return null
  return parsed.toString()
}

export type TLoginLinkOutcome =
  | { kind: 'redirect' }
  | { kind: 'error'; redirectTo: string }
  | { kind: 'recover'; email: string; callbackURL: string }
  | { kind: 'otp'; email: string; role: TMagicLinkRole; callbackURL: string; isCodeExpired: boolean }

/**
 * Un lien encore valable suit la redirection habituelle. S'il a déjà été consommé (typiquement par un
 * scanner de mails), le navigateur à l'origine de la demande est reconnu par son cookie ; ailleurs, on
 * demande le code envoyé avec le lien.
 */
export async function resolveLoginLinkOutcome(verifyUrl: string): Promise<TLoginLinkOutcome> {
  const params = new URL(verifyUrl).searchParams
  const token = params.get('token')
  const attempt = token ? await findLoginAttemptByToken(token) : null
  if (!attempt?.email || !isMagicLinkRole(attempt.role)) {
    return { kind: 'error', redirectTo: safeCallbackPath(params.get('errorCallbackURL'), '/verification/erreur') ?? '/verification/erreur' }
  }

  const isExpired = attempt.expiresAt <= new Date()
  if (attempt.status === ELoginAttemptStatus.EMAIL_SENT && !isExpired) return { kind: 'redirect' }

  const callbackURL = safeCallbackPath(params.get('callbackURL')) ?? DEFAULT_CALLBACK_BY_ROLE[attempt.role]
  if (!isExpired && (await isBoundToThisBrowser(attempt.bindingHash))) {
    return { kind: 'recover', email: attempt.email, callbackURL }
  }

  return { kind: 'otp', email: attempt.email, role: attempt.role, callbackURL, isCodeExpired: isExpired }
}
