import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildWpPath, proxyWp } from './wp-proxy'

afterEach(() => {
  vi.unstubAllGlobals()
})

const htmlResponse = (body = '<html><script>alert(1)</script></html>', headers: Record<string, string> = {}) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })

describe('buildWpPath', () => {
  it('construit le chemin WordPress à partir de slugs', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['aix-en-provence'])).toBe('/preparer-sa-vie-etudiante/aix-en-provence/')
  })

  it('normalise les noms de ville envoyés par l’autocomplétion', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['Nîmes'])).toBe('/preparer-sa-vie-etudiante/nimes/')
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['Le Mans'])).toBe('/preparer-sa-vie-etudiante/le-mans/')
  })

  it('refuse toute remontée d’arborescence ou caractère hors slug', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['..', 'wp-json'])).toBeNull()
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['../wp-json'])).toBeNull()
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['paris?rest_route=/'])).toBeNull()
    expect(buildWpPath('/partenariat', ['wp-login.php'])).toBeNull()
    expect(buildWpPath('/partenariat', [''])).toBeNull()
  })
})

describe('proxyWp', () => {
  it('ne relaie que les paramètres de requête connus (pas de JSONP ni de REST)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse())
    vi.stubGlobal('fetch', fetchMock)

    await proxyWp(new Request('https://app.test/foire-aux-questions?rest_route=/wp/v2/types&_jsonp=foo&media_link=1&utm_source=x'), {
      path: '/foire-aux-questions/',
    })

    expect(fetchMock.mock.calls[0]![0]).toBe('https://info.monlogementetudiant.beta.gouv.fr/foire-aux-questions/?media_link=1')
  })

  it('ne relaie pas une réponse autre que du HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('/**/foo({})', { headers: { 'content-type': 'application/javascript' } })),
    )

    const response = await proxyWp(new Request('https://app.test/foire-aux-questions'), { path: '/foire-aux-questions/' })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('foo(')
  })

  it('relaie le HTML sans cookie WordPress et sous une CSP sans script', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse(undefined, { 'set-cookie': 'wordpress_session=secret' })))

    const response = await proxyWp(new Request('https://app.test/foire-aux-questions'), { path: '/foire-aux-questions/' })

    expect(response.status).toBe(200)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(response.headers.get('content-security-policy')).toContain("script-src 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('ne transmet aucun en-tête de la requête entrante à WordPress', async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse())
    vi.stubGlobal('fetch', fetchMock)

    await proxyWp(
      new Request('https://app.test/foire-aux-questions', {
        headers: { authorization: 'Bearer app-secret', cookie: 'monlogementetudiant.session_token=secret' },
      }),
      { path: '/foire-aux-questions/' },
    )

    const init = fetchMock.mock.calls[0]![1] as RequestInit | undefined
    const forwarded = new Headers(init?.headers)
    expect(forwarded.has('authorization')).toBe(false)
    expect(forwarded.has('cookie')).toBe(false)
  })
})
