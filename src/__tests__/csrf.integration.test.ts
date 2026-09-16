import { describe, expect, it } from 'vitest'
import './helpers/setup-integration'

const TRPC_URL = 'http://localhost:3000/api/trpc/dossierFacile.disconnect'

describe('CSRF — /api/trpc', () => {
  it('refuse une mutation postée en multipart/form-data, possible sans preflight depuis une autre page', async () => {
    const { POST } = await import('~/app/api/trpc/[trpc]/route')

    const res = await POST(new Request(TRPC_URL, { method: 'POST', body: new FormData(), headers: { 'sec-fetch-site': 'same-site' } }))

    expect(res.status).toBe(415)
  })

  it('refuse une mutation JSON venant d’un sous-domaine voisin', async () => {
    const { POST } = await import('~/app/api/trpc/[trpc]/route')

    const res = await POST(
      new Request(TRPC_URL, {
        method: 'POST',
        body: '{}',
        headers: {
          'content-type': 'application/json',
          origin: 'https://info.monlogementetudiant.beta.gouv.fr',
          'sec-fetch-site': 'same-site',
        },
      }),
    )

    expect(res.status).toBe(403)
  })

  it('laisse passer une mutation JSON de notre origine jusqu’à tRPC', async () => {
    const { POST } = await import('~/app/api/trpc/[trpc]/route')

    const res = await POST(
      new Request(TRPC_URL, {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' },
      }),
    )

    expect([403, 415]).not.toContain(res.status)
  })
})

describe('CSRF — route d’upload', () => {
  it('refuse un envoi de fichiers depuis une autre origine', async () => {
    const { POST } = await import('~/app/api/accommodations/my/[slug]/upload/route')

    const res = await POST(
      new Request('http://localhost:3000/api/accommodations/my/res/upload/', {
        method: 'POST',
        body: new FormData(),
        headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      }),
      { params: Promise.resolve({ slug: 'res' }) },
    )

    expect(res.status).toBe(403)
  })
})
