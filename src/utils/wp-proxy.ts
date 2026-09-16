const WP_ORIGIN = 'https://info.monlogementetudiant.beta.gouv.fr'

const RELAYED_RESPONSE_HEADERS = ['cache-control', 'content-language', 'content-type', 'etag', 'last-modified', 'location'] as const
const HTML_SECURITY_POLICY = [
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join('; ')

function relayResponseHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const key of RELAYED_RESPONSE_HEADERS) {
    const value = source.get(key)
    if (value !== null) headers.set(key, value)
  }
  // Le HTML WordPress est rendu sous l'origine de l'application. Interdire tout script empêche
  // qu'une compromission du CMS ne devienne une prise de contrôle des sessions applicatives.
  headers.set('content-security-policy', HTML_SECURITY_POLICY)
  headers.set('x-content-type-options', 'nosniff')
  return headers
}

/** Un segment d'URL WordPress : un slug, rien d'autre (ni `..`, ni `?`, ni `.php`). */
const SLUG_SEGMENT = /^[a-z0-9-]+$/

/**
 * Paramètres de requête relayés. Tout le reste est retiré : `rest_route` et `_jsonp` exposeraient l'API
 * REST de WordPress (et du JSONP exécutable) sous notre origine, et chaque paramètre inconnu créerait
 * une entrée de plus dans le Data Cache.
 */
const RELAYED_QUERY_PARAMS = ['media_link', 'paged'] as const

/**
 * Construit le chemin WordPress d'une page relayée, ou `null` si un segment n'est pas un slug.
 *
 * Les segments arrivent décodés par Next : sans validation, `..%2Fwp-json` remonterait l'arborescence
 * (`fetch` normalise `..`). Les liens de l'app envoient parfois un nom de ville brut (« Nîmes »,
 * « Le Mans ») : on le ramène à la forme de slug WordPress avant de valider.
 */
export function buildWpPath(prefix: string, segments: string[]): string | null {
  const slugs = segments.map((segment) =>
    segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-'),
  )
  if (slugs.some((slug) => !SLUG_SEGMENT.test(slug))) return null
  return `${prefix}/${slugs.join('/')}/`
}

function relayedSearch(requestUrl: string): string {
  const incoming = new URL(requestUrl).searchParams
  const relayed = new URLSearchParams()
  for (const key of RELAYED_QUERY_PARAMS) {
    const value = incoming.get(key)
    if (value !== null) relayed.set(key, value)
  }
  const search = relayed.toString()
  return search ? `?${search}` : ''
}

export const wpNotFound = () => new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })

type ProxyWpOptions = {
  /** Chemin (avec slash initial) sur l'origine WordPress, ex. '/foire-aux-questions/'. */
  path: string
  /** Fraîcheur du Data Cache Next en secondes (défaut 6h). */
  revalidate?: number
}

/**
 * Proxy cachant les pages du WordPress `info.` au niveau de l'app.
 *
 * GET uniquement, mis en cache par le Data Cache de Next (clé = URL amont, query filtrée comprise) :
 * WordPress n'est retapé qu'une fois par page et par `revalidate`, quel que soit le trafic. Les pages
 * publiques ne posent pas de cookie → le cache partagé est sûr. Aucune page relayée n'a de formulaire :
 * pas de POST, qui ouvrirait `wp-login.php` / `xmlrpc.php` depuis l'IP du conteneur.
 *
 * Seul le HTML est relayé : un autre type (JSON, JSONP, XML) servi sous notre origine contournerait les
 * politiques fondées sur `'self'`.
 */
export async function proxyWp(request: Request, { path, revalidate = 21600 }: ProxyWpOptions) {
  const upstream = `${WP_ORIGIN}${path}${relayedSearch(request.url)}`

  const response = await fetch(upstream, { next: { revalidate } })
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) return wpNotFound()

  const body = await response.text()
  const headers = relayResponseHeaders(response.headers)
  headers.set('cache-control', `public, s-maxage=${revalidate}, stale-while-revalidate=86400`)

  return new Response(body, { status: response.status, headers })
}
