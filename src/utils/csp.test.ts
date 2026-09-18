import { describe, expect, it } from 'vitest'
import { buildStrictCsp, generateNonce } from './csp'

describe('buildStrictCsp', () => {
  it('n’autorise que les scripts porteurs du nonce, sans unsafe-inline', () => {
    const csp = buildStrictCsp({ nonce: 'abc', isDev: false, reportUri: 'https://sentry.example/api/1/security/?sentry_key=k' })
    expect(csp).toBe(
      "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'self'; report-uri https://sentry.example/api/1/security/?sentry_key=k",
    )
    expect(csp).not.toContain('unsafe-inline')
  })

  it('ajoute unsafe-eval en dev et omet report-uri sans destination', () => {
    expect(buildStrictCsp({ nonce: 'abc', isDev: true })).toBe(
      "script-src 'nonce-abc' 'strict-dynamic' 'unsafe-eval'; object-src 'none'; base-uri 'self'",
    )
  })
})

describe('generateNonce', () => {
  it('produit un nonce différent à chaque appel', () => {
    expect(generateNonce()).not.toBe(generateNonce())
  })
})
