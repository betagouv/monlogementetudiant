import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyWp } from './wp-proxy'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('proxyWp', () => {
  it('does not disclose credentials to WordPress on POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html><script>alert(1)</script></html>', {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'set-cookie': 'wordpress_session=secret',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await proxyWp(
      new Request('https://app.test/landing/contact', {
        method: 'POST',
        body: 'name=Alice',
        headers: {
          authorization: 'Bearer app-secret',
          cookie: 'monlogementetudiant.session_token=session-secret',
          'content-type': 'application/x-www-form-urlencoded',
          'x-api-key': 'api-secret',
        },
      }),
      { path: '/partenariat/contact/' },
    )

    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(forwardedHeaders.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(forwardedHeaders.has('authorization')).toBe(false)
    expect(forwardedHeaders.has('cookie')).toBe(false)
    expect(forwardedHeaders.has('x-api-key')).toBe(false)

    expect(response.headers.has('set-cookie')).toBe(false)
    expect(response.headers.get('content-security-policy')).toContain("script-src 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})
