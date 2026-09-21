import { env } from '~/server/env'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Vérifie qu'une requête non sûre (POST…) vient de l'origine de l'application : `Sec-Fetch-Site` à
 * `same-origin` ou `none`, et `Origin` égale à celle de `BASE_URL` quand elle est présente. Une requête
 * sans ces en-têtes (client non navigateur) est acceptée.
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
