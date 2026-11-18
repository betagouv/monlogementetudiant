import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('~/server/services/s3', () => ({
  s3: { send: sendMock },
  IMMUTABLE_CACHE_CONTROL: 'public, max-age=15552000, immutable',
  IMAGE_CACHE_PREFIX: 'image-cache/',
  PURGE_ARCHIVE_PREFIX: 'purges/',
}))

vi.mock('@aws-sdk/client-s3', () => ({
  ListObjectsV2Command: class {
    constructor(public input: Record<string, unknown>) {
      Object.assign(this, input, { __type: 'list' })
    }
  },
  HeadObjectCommand: class {
    constructor(public input: Record<string, unknown>) {
      Object.assign(this, input, { __type: 'head' })
    }
  },
  CopyObjectCommand: class {
    constructor(public input: Record<string, unknown>) {
      Object.assign(this, input, { __type: 'copy' })
    }
  },
}))

const { __testing } = await import('../backfill-cache-control')

describe('backfill-cache-control', () => {
  beforeEach(() => {
    sendMock.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => console.log)
    vi.spyOn(console, 'error').mockImplementation(() => console.error)
  })

  describe('backfillKey', () => {
    it('recopie l’objet sur lui-même en conservant son type de contenu', async () => {
      sendMock.mockResolvedValueOnce({ ContentType: 'image/jpeg' }).mockResolvedValueOnce({})

      const outcome = await __testing.backfillKey('accommodations/abc123.jpg', {})

      expect(outcome).toBe('updated')
      expect(sendMock.mock.calls[1][0]).toMatchObject({
        __type: 'copy',
        Bucket: 'test-bucket',
        Key: 'accommodations/abc123.jpg',
        CopySource: 'test-bucket/accommodations/abc123.jpg',
        MetadataDirective: 'REPLACE',
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=15552000, immutable',
        ACL: 'public-read',
      })
    })

    it('encode les clés à espaces et accents sans casser la séparation des dossiers', async () => {
      sendMock.mockResolvedValueOnce({ ContentType: 'image/jpeg' }).mockResolvedValueOnce({})

      await __testing.backfillKey('accommodations/Résidence Été/pictures/abc.jpg', {})

      expect(sendMock.mock.calls[1][0].CopySource).toBe('test-bucket/accommodations/R%C3%A9sidence%20%C3%89t%C3%A9/pictures/abc.jpg')
    })

    it('ignore un objet déjà à jour — la commande est rejouable', async () => {
      sendMock.mockResolvedValueOnce({ ContentType: 'image/jpeg', CacheControl: 'public, max-age=15552000, immutable' })

      const outcome = await __testing.backfillKey('accommodations/abc123.jpg', {})

      expect(outcome).toBe('skipped')
      expect(sendMock).toHaveBeenCalledOnce()
    })

    it('n’écrit rien en dry-run', async () => {
      sendMock.mockResolvedValueOnce({ ContentType: 'image/jpeg' })

      const outcome = await __testing.backfillKey('accommodations/abc123.jpg', { dryRun: true })

      expect(outcome).toBe('updated')
      expect(sendMock).toHaveBeenCalledOnce()
    })

    it('signale l’échec sans interrompre le lot', async () => {
      sendMock.mockRejectedValueOnce(new Error('AccessDenied'))

      await expect(__testing.backfillKey('accommodations/abc123.jpg', {})).resolves.toBe('error')
    })
  })

  describe('listKeys', () => {
    it('suit la pagination S3', async () => {
      sendMock
        .mockResolvedValueOnce({ Contents: [{ Key: 'a.jpg' }], NextContinuationToken: 'token' })
        .mockResolvedValueOnce({ Contents: [{ Key: 'b.jpg' }] })

      await expect(__testing.listKeys('accommodations/')).resolves.toEqual(['a.jpg', 'b.jpg'])
    })

    it('s’arrête à la limite demandée', async () => {
      sendMock.mockResolvedValueOnce({ Contents: [{ Key: 'a.jpg' }, { Key: 'b.jpg' }], NextContinuationToken: 'token' })

      await expect(__testing.listKeys('accommodations/', 1)).resolves.toEqual(['a.jpg'])
      expect(sendMock).toHaveBeenCalledOnce()
    })
  })

  describe('listKeysForPrefixes', () => {
    it('balaye tout le bucket par défaut — les médias sont éparpillés dans ~35 dossiers', async () => {
      expect(__testing.DEFAULT_PREFIXES).toEqual([''])
    })

    it('écarte les préfixes gérés par l’application, même listés depuis la racine', async () => {
      sendMock.mockResolvedValueOnce({
        Contents: [{ Key: 'bmh-images/a.jpg' }, { Key: 'image-cache/deadbeef' }, { Key: 'purges/2026-08.ndjson' }, { Key: 'racine.jpg' }],
      })

      await expect(__testing.listKeysForPrefixes([''])).resolves.toEqual(['bmh-images/a.jpg', 'racine.jpg'])
    })

    it('dédoublonne les recouvrements entre préfixes', async () => {
      sendMock
        .mockResolvedValueOnce({ Contents: [{ Key: 'accommodations/a.jpg' }] })
        .mockResolvedValueOnce({ Contents: [{ Key: 'accommodations/a.jpg' }, { Key: 'crous-images/b.jpg' }] })

      await expect(__testing.listKeysForPrefixes(['accommodations/', ''])).resolves.toEqual(['accommodations/a.jpg', 'crous-images/b.jpg'])
    })

    it('applique la limite globalement, pas par préfixe', async () => {
      sendMock.mockResolvedValueOnce({ Contents: [{ Key: 'accommodations/a.jpg' }] })

      await expect(__testing.listKeysForPrefixes(['accommodations/', 'crous-images/'], 1)).resolves.toEqual(['accommodations/a.jpg'])
      expect(sendMock).toHaveBeenCalledOnce()
    })
  })

  describe('garde-fou non-image', () => {
    it('ignore un objet qui n’est pas une image plutôt que de le rendre public', async () => {
      sendMock.mockResolvedValueOnce({ ContentType: 'application/json' })

      const outcome = await __testing.backfillKey('un-export/eta.json', {})

      expect(outcome).toBe('ignored')
      expect(sendMock).toHaveBeenCalledOnce()
    })

    it('ignore aussi un objet sans ContentType', async () => {
      sendMock.mockResolvedValueOnce({})

      await expect(__testing.backfillKey('inconnu.bin', {})).resolves.toBe('ignored')
      expect(sendMock).toHaveBeenCalledOnce()
    })
  })
})
