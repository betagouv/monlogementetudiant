const WP_ORIGIN = 'https://info.monlogementetudiant.beta.gouv.fr'

const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'user-agent'] as const
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
  if (headers.get('content-type')?.toLowerCase().includes('text/html')) {
    headers.set('content-security-policy', HTML_SECURITY_POLICY)
  }
  headers.set('x-content-type-options', 'nosniff')
  return headers
}

function forwardRequestHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const key of FORWARDED_REQUEST_HEADERS) {
    const value = source.get(key)
    if (value !== null) headers.set(key, value)
  }
  return headers
}

type ProxyWpOptions = {
  /** Chemin (avec slash initial) sur l'origine WordPress, ex. '/foire-aux-questions/'. */
  path: string
  /** Fraîcheur du Data Cache Next en secondes (défaut 6h). */
  revalidate?: number
}

/**
 * Proxy cachant les pages du WordPress `info.` au niveau de l'app.
 *
 * Les GET sont mis en cache par le Data Cache de Next (clé = URL complète, query comprise) :
 * WordPress n'est retapé qu'une fois par page et par `revalidate`, quel que soit le trafic.
 * Les pages publiques ne posent pas de cookie → le cache partagé est sûr.
 * Les autres méthodes (formulaires) passent en direct, sans cache.
 */
export async function proxyWp(request: Request, { path, revalidate = 21600 }: ProxyWpOptions) {
  const { search } = new URL(request.url)
  const upstream = `${WP_ORIGIN}${path}${search}`

  if (request.method !== 'GET') {
    const passthrough = await fetch(upstream, {
      method: request.method,
      headers: forwardRequestHeaders(request.headers),
      // Corps bufferisé : ce sont de petits POST de formulaire, pas de streaming à gérer.
      body: await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    })

    return new Response(passthrough.body, {
      status: passthrough.status,
      headers: relayResponseHeaders(passthrough.headers),
    })
  }

  const response = await fetch(upstream, { next: { revalidate } })
  const body = await response.text()
  const headers = relayResponseHeaders(response.headers)
  headers.set('cache-control', `public, s-maxage=${revalidate}, stale-while-revalidate=86400`)

  return new Response(body, { status: response.status, headers })
}
