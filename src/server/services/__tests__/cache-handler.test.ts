import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le handler vit à la racine (`cache-handler.mjs`) parce que Next le charge hors du graphe
 * de modules de l'application. Le test l'importe donc par chemin relatif, et passe par un
 * import dynamique : le budget mémoire est figé au chargement du module, il faut pouvoir
 * le faire varier d'un cas à l'autre.
 */

const sendMock = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock
  },
  GetObjectCommand: class {
    constructor(public input: Record<string, unknown>) {
      Object.assign(this, input)
    }
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {
      Object.assign(this, input)
    }
  },
}))

const IMAGE_VALUE = {
  kind: 'IMAGE',
  buffer: Buffer.from('optimized-bytes'),
  etag: 'etag-123',
  upstreamEtag: 'upstream-456',
  extension: 'webp',
  revalidate: 15552000,
}

/** Le handler étant du JS non typé, on décrit ici la surface dont les tests se servent. */
type CachedImage = {
  kind: string
  etag: string
  upstreamEtag: string
  extension: string
  revalidate: number
  buffer: Buffer
}

type HandlerModule = {
  default: new (
    ctx: Record<string, unknown>,
  ) => {
    get(key: string, ctx: { kind: string }): Promise<{ lastModified: number; value: CachedImage } | null>
    set(key: string, value: Record<string, unknown>, ctx: Record<string, unknown>): Promise<void>
  }
  __testing: { clearMemory(): void; memorySize(): number; memoryBytes(): number; isS3Disabled(): boolean; PREFIX: string }
}

async function loadHandler(): Promise<HandlerModule> {
  vi.resetModules()
  // Passage par `unknown` : le handler est du JS non type, sa forme inferee ne recoupe pas
  // la surface decrite ci-dessus.
  const module = (await import('../../../../cache-handler.mjs')) as unknown as HandlerModule
  module.__testing.clearMemory()
  return module
}

describe('cache-handler', () => {
  beforeEach(() => {
    sendMock.mockReset()
    vi.unstubAllEnvs()
    // Les cas espionnent la console : sans restauration, `vi.spyOn` reutilise le meme mock
    // d'un test a l'autre et les compteurs d'appels s'accumulent.
    vi.restoreAllMocks()
  })

  describe('entrées IMAGE', () => {
    it('écrit la dérivée dans S3 sous le préfixe dédié', async () => {
      const { default: MleCacheHandler, __testing } = await loadHandler()
      sendMock.mockResolvedValueOnce({})

      await new MleCacheHandler({}).set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 15552000 } })

      expect(sendMock).toHaveBeenCalledOnce()
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: `${__testing.PREFIX}abc123`,
          Body: IMAGE_VALUE.buffer,
          ContentType: 'image/webp',
          Metadata: {
            etag: 'etag-123',
            'upstream-etag': 'upstream-456',
            extension: 'webp',
            revalidate: '15552000',
          },
        }),
      )
    })

    it("ne pose pas d'ACL publique sur les dérivées", async () => {
      const { default: MleCacheHandler } = await loadHandler()
      sendMock.mockResolvedValueOnce({})

      await new MleCacheHandler({}).set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 15552000 } })

      expect(sendMock.mock.calls[0][0]).not.toHaveProperty('ACL')
    })

    it('relit depuis la mémoire sans repasser par S3', async () => {
      const { default: MleCacheHandler } = await loadHandler()
      const handler = new MleCacheHandler({})
      sendMock.mockResolvedValueOnce({})

      await handler.set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 15552000 } })
      sendMock.mockReset()

      const result = await handler.get('abc123', { kind: 'IMAGE' })

      expect(sendMock).not.toHaveBeenCalled()
      expect(result?.value).toMatchObject({
        kind: 'IMAGE',
        etag: 'etag-123',
        upstreamEtag: 'upstream-456',
        extension: 'webp',
        buffer: IMAGE_VALUE.buffer,
      })
    })

    it('relit depuis S3 quand la mémoire du container est vide', async () => {
      const { default: MleCacheHandler } = await loadHandler()
      const lastModified = new Date('2026-08-01T10:00:00Z')
      sendMock.mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array(IMAGE_VALUE.buffer) },
        Metadata: { etag: 'etag-123', 'upstream-etag': 'upstream-456', extension: 'webp', revalidate: '15552000' },
        LastModified: lastModified,
      })

      const result = await new MleCacheHandler({}).get('abc123', { kind: 'IMAGE' })

      expect(result?.lastModified).toBe(lastModified.getTime())
      expect(result?.value).toMatchObject({ kind: 'IMAGE', etag: 'etag-123', extension: 'webp', revalidate: 15552000 })
      expect(result?.value.buffer.toString()).toBe('optimized-bytes')
    })

    it('traite une clé absente comme un miss', async () => {
      const { default: MleCacheHandler } = await loadHandler()
      sendMock.mockRejectedValueOnce(Object.assign(new Error('not found'), { name: 'NoSuchKey' }))

      await expect(new MleCacheHandler({}).get('abc123', { kind: 'IMAGE' })).resolves.toBeNull()
    })

    it("laisse l'optimiseur décider du TTL quand la métadonnée revalidate est illisible", async () => {
      const { default: MleCacheHandler } = await loadHandler()
      sendMock.mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array(IMAGE_VALUE.buffer) },
        Metadata: { etag: 'etag-123', extension: 'webp' },
      })

      const result = await new MleCacheHandler({}).get('abc123', { kind: 'IMAGE' })

      // `undefined` et non NaN : sinon l'optimiseur considère l'entrée éternellement fraîche.
      expect(result?.value.revalidate).toBeUndefined()
    })

    it('traite une entrée S3 sans métadonnées comme un miss', async () => {
      const { default: MleCacheHandler } = await loadHandler()
      sendMock.mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array(IMAGE_VALUE.buffer) },
        Metadata: {},
      })

      await expect(new MleCacheHandler({}).get('abc123', { kind: 'IMAGE' })).resolves.toBeNull()
    })

    it("n'échoue pas quand S3 est indisponible à l'écriture", async () => {
      const { default: MleCacheHandler } = await loadHandler()
      vi.spyOn(console, 'error').mockImplementation(() => console.error)
      sendMock.mockRejectedValueOnce(new Error('S3 indisponible'))
      const handler = new MleCacheHandler({})

      await expect(handler.set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 15552000 } })).resolves.toBeUndefined()

      // Le L1 a quand même l'entrée : ce container-là n'aura pas à réencoder.
      sendMock.mockReset()
      expect(await handler.get('abc123', { kind: 'IMAGE' })).not.toBeNull()
    })
  })

  describe('étage S3 débrayable', () => {
    it('ne touche pas à S3 quand IMAGE_CACHE_S3_DISABLED est posé', async () => {
      vi.stubEnv('IMAGE_CACHE_S3_DISABLED', '1')
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { default: MleCacheHandler } = await loadHandler()
      const handler = new MleCacheHandler({})

      await handler.set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 15552000 } })

      expect(sendMock).not.toHaveBeenCalled()
      // Le L1 fait tout le travail : c'est le mode attendu en local.
      expect(await handler.get('abc123', { kind: 'IMAGE' })).not.toBeNull()
    })

    it("débraie S3 au premier refus de droits, et n'y revient plus", async () => {
      const { default: MleCacheHandler, __testing } = await loadHandler()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      sendMock.mockRejectedValue(Object.assign(new Error('Access Denied'), { Code: 'AccessDenied', $metadata: { httpStatusCode: 403 } }))
      const handler = new MleCacheHandler({})

      await handler.set('first', IMAGE_VALUE, { cacheControl: { revalidate: 60 } })
      await handler.set('second', IMAGE_VALUE, { cacheControl: { revalidate: 60 } })
      await handler.set('third', IMAGE_VALUE, { cacheControl: { revalidate: 60 } })

      // Une seule tentative, un seul avertissement.
      expect(sendMock).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledOnce()
      expect(error).not.toHaveBeenCalled()
      expect(__testing.isS3Disabled()).toBe(true)
    })

    it('continue de signaler les incidents S3 qui ne sont pas des refus de droits', async () => {
      const { default: MleCacheHandler, __testing } = await loadHandler()
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      sendMock.mockRejectedValue(new Error('S3 indisponible'))

      await new MleCacheHandler({}).set('abc123', IMAGE_VALUE, { cacheControl: { revalidate: 60 } })

      expect(error).toHaveBeenCalledOnce()
      expect(__testing.isS3Disabled()).toBe(false)
    })
  })

  describe('budget mémoire', () => {
    it('évince les entrées les plus anciennes au-delà du budget', async () => {
      vi.stubEnv('IMAGE_CACHE_MEMORY_MB', '0.00001') // ~10 octets
      const { default: MleCacheHandler, __testing } = await loadHandler()
      const handler = new MleCacheHandler({})
      sendMock.mockResolvedValue({})

      await handler.set('first', { ...IMAGE_VALUE, buffer: Buffer.alloc(8) }, { cacheControl: { revalidate: 60 } })
      await handler.set('second', { ...IMAGE_VALUE, buffer: Buffer.alloc(8) }, { cacheControl: { revalidate: 60 } })

      expect(__testing.memorySize()).toBe(1)
      expect(__testing.memoryBytes()).toBe(8)
    })
  })

  describe('autres entrées du cache incrémental', () => {
    it('délègue au FileSystemCache de Next', async () => {
      const { default: MleCacheHandler } = await loadHandler()
      const parent = Object.getPrototypeOf(MleCacheHandler.prototype)
      const parentGet = vi.spyOn(parent, 'get').mockResolvedValue(null)
      const parentSet = vi.spyOn(parent, 'set').mockResolvedValue(undefined)
      const handler = new MleCacheHandler({})

      await handler.get('/une-page', { kind: 'APP_PAGE' })
      await handler.set('une-clé-fetch', { kind: 'FETCH', data: {} }, { cacheControl: { revalidate: 3600 } })

      expect(parentGet).toHaveBeenCalledWith('/une-page', { kind: 'APP_PAGE' })
      expect(parentSet).toHaveBeenCalled()
      expect(sendMock).not.toHaveBeenCalled()

      parentGet.mockRestore()
      parentSet.mockRestore()
    })
  })
})
