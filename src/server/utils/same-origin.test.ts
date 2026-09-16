import { describe, expect, it } from 'vitest'
import { isSameOriginRequest } from './same-origin'

const post = (headers: Record<string, string>) => new Request('http://localhost:3000/api/x', { method: 'POST', headers })

describe('isSameOriginRequest', () => {
  it('accepte une requête de notre origine', () => {
    expect(isSameOriginRequest(post({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  it('refuse un autre sous-domaine', () => {
    expect(isSameOriginRequest(post({ origin: 'https://info.beta.gouv.fr', 'sec-fetch-site': 'same-site' }))).toBe(false)
  })

  it('refuse une origine étrangère même sans Sec-Fetch-Site', () => {
    expect(isSameOriginRequest(post({ origin: 'https://evil.example' }))).toBe(false)
  })

  it('refuse une requête cross-site sans Origin', () => {
    expect(isSameOriginRequest(post({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })

  it('laisse passer les méthodes sûres et les clients non navigateurs', () => {
    expect(isSameOriginRequest(new Request('http://localhost:3000/api/x', { headers: { origin: 'https://evil.example' } }))).toBe(true)
    expect(isSameOriginRequest(post({}))).toBe(true)
  })
})
