import { env } from '~/server/env'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Garde CSRF des route handlers qui s'appuient sur le cookie de session.
 *
 * SameSite=Lax ne suffit pas : tous les `*.beta.gouv.fr` sont du même « site » (seul `gouv.fr` figure dans
 * la Public Suffix List), donc une page ou une XSS sur n'importe lequel d'entre eux envoie nos cookies.
 * On exige que les requêtes non sûres viennent de notre **origine** :
 * - `Sec-Fetch-Site` (posé par tous les navigateurs récents) doit valoir `same-origin` ou `none` ;
 * - `Origin`, quand il est présent, doit être celle de `BASE_URL`.
 *
 * Une requête sans aucun de ces en-têtes ne vient pas d'un navigateur (curl, appel serveur à serveur) :
 * elle ne porte pas les cookies d'une victime, il n'y a rien à protéger.
 */
export const isSameOriginRequest = (request: Request): boolean => {
  if (SAFE_METHODS.has(request.method)) return true

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(env.BASE_URL).origin) return false

  return true
}

export const crossOriginForbidden = () => Response.json({ error: 'Requête refusée : origine non autorisée.' }, { status: 403 })
