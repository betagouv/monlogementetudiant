import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDetachedOneOff } from './scalingo'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const launch = () =>
  runDetachedOneOff({
    apiToken: 'tk',
    region: 'osc-secnum-fr1',
    app: 'mle-worker',
    command: 'npx tsx apps/worker/index.ts sync stats',
    env: { JOB_RUN_ID: '42' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runDetachedOneOff', () => {
  it('échange le token puis lance un one-off détaché de taille M', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 'bearer' }))
      .mockResolvedValueOnce(json({ container: { id: 'ctn-1', type: 'one-off' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(launch()).resolves.toEqual({ containerId: 'ctn-1' })

    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.scalingo.com/v1/tokens/exchange')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from(':tk').toString('base64')}`)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://api.osc-secnum-fr1.scalingo.com/v1/apps/mle-worker/run')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer bearer')
    expect(JSON.parse(init.body)).toEqual({
      command: 'npx tsx apps/worker/index.ts sync stats',
      env: { JOB_RUN_ID: '42' },
      size: 'M',
      detached: true,
    })
  })

  it('remonte le statut HTTP quand le lancement est refusé', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: 'bearer' }))
        .mockResolvedValueOnce(json({ error: 'forbidden' }, 403)),
    )
    await expect(launch()).rejects.toThrow('403')
  })

  it('refuse une réponse inattendue', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: 'bearer' }))
        .mockResolvedValueOnce(json({ nope: true })),
    )
    await expect(launch()).rejects.toThrow('Réponse Scalingo inattendue')
  })
})
