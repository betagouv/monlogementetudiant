import { describe, expect, it } from 'vitest'
import { assertPublicRateLimit } from '~/server/rate-limit/public-rate-limit'
import './helpers/setup-integration'

describe('assertPublicRateLimit', () => {
  it('rejects requests beyond the shared per-IP limit', async () => {
    const options = { clientIp: '203.0.113.10', scope: 'test', maxRequests: 2, windowMs: 60_000 }

    await expect(assertPublicRateLimit(options)).resolves.toBeUndefined()
    await expect(assertPublicRateLimit(options)).resolves.toBeUndefined()
    await expect(assertPublicRateLimit(options)).rejects.toThrow(/Trop de requêtes/)
  })

  it('isolates counters by IP and scope', async () => {
    const common = { maxRequests: 1, windowMs: 60_000 }

    await expect(assertPublicRateLimit({ ...common, clientIp: '203.0.113.11', scope: 'a' })).resolves.toBeUndefined()
    await expect(assertPublicRateLimit({ ...common, clientIp: '203.0.113.12', scope: 'a' })).resolves.toBeUndefined()
    await expect(assertPublicRateLimit({ ...common, clientIp: '203.0.113.11', scope: 'b' })).resolves.toBeUndefined()
  })
})
