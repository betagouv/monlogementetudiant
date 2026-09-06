import { toNextJsHandler } from 'better-auth/next-js'
import { recordMagicLinkVerification } from '~/server/services/login-attempts'
import { auth } from '~/services/better-auth'

const handlers = toNextJsHandler(auth)

const MAGIC_LINK_VERIFY_PATH = '/magic-link/verify'

/**
 * Une vérification réussie pose un cookie de session et redirige vers la `callbackURL`. En échec,
 * le plugin `magicLink` redirige vers cette même URL en y ajoutant `?error=…` (aucune
 * `errorCallbackURL` n'étant fournie). C'est donc la présence de ce paramètre — et non le code
 * HTTP, qui vaut 302 dans les deux cas — qui distingue les deux issues.
 */
function isVerificationSuccessful(response: Response): boolean {
  if (response.status >= 400) return false

  const location = response.headers.get('location')
  if (!location) return response.status < 300 // réponse JSON : succès sans callbackURL

  try {
    return !new URL(location, 'http://localhost').searchParams.has('error')
  } catch {
    return false
  }
}

export const { POST } = handlers

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const token = url.pathname.endsWith(MAGIC_LINK_VERIFY_PATH) ? url.searchParams.get('token') : null

  const response = await handlers.GET(request)

  if (token) {
    await recordMagicLinkVerification({
      token,
      success: isVerificationSuccessful(response),
      userAgent: request.headers.get('user-agent'),
    })
  }

  return response
}
