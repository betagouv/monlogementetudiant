function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function stubResponse(url: URL): Response | null {
  switch (url.host) {
    case 'geo.api.gouv.fr':
      return json([])
    case 'data.geopf.fr':
      return json({ type: 'FeatureCollection', features: [] })
    case 'api.brevo.com':
      return url.pathname === '/v3/smtp/email' ? json({ messageId: '<stub@test.local>' }, 201) : json({}, 201)
    default:
      return null
  }
}

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
}

export function installExternalFetchStub() {
  const realFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (isLocal(url)) return realFetch(input, init)

    const response = stubResponse(url)
    if (!response) throw new Error(`Appel réseau externe non mocké dans les tests d'intégration : ${url.origin}${url.pathname}`)
    return response
  }) as typeof fetch
}
