import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = sendMock
    },
    PutObjectCommand: class {
      constructor(public input: Record<string, unknown>) {
        Object.assign(this, input)
      }
    },
    DeleteObjectCommand: class {
      constructor(public input: Record<string, unknown>) {
        Object.assign(this, input)
      }
    },
  }
})

vi.stubEnv('S3_ENDPOINT', 'https://s3.test.example.com')
vi.stubEnv('S3_REGION', 'gra')
vi.stubEnv('S3_BUCKET', 'test-bucket')
vi.stubEnv('S3_ACCESS_KEY_ID', 'test-key')
vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test-secret')

describe('s3 service', () => {
  beforeEach(() => {
    sendMock.mockReset()
  })

  describe('generateAccommodationKey', () => {
    it('generates key with correct format', async () => {
      const { generateAccommodationKey } = await import('./s3')
      const key = generateAccommodationKey('jpg')

      expect(key).toMatch(/^accommodations\/[a-f0-9]{32}\.jpg$/)
    })

    it('generates unique keys', async () => {
      const { generateAccommodationKey } = await import('./s3')
      const key1 = generateAccommodationKey('jpg')
      const key2 = generateAccommodationKey('jpg')

      expect(key1).not.toBe(key2)
    })

    it('includes S3_SUFFIX_DIR when set', async () => {
      vi.stubEnv('S3_SUFFIX_DIR', '-staging')
      const { generateAccommodationKey } = await import('./s3')
      const key = generateAccommodationKey('png')

      expect(key).toMatch(/^accommodations-staging\/[a-f0-9]{32}\.png$/)
      vi.unstubAllEnvs()
      vi.stubEnv('S3_ENDPOINT', 'https://s3.test.example.com')
      vi.stubEnv('S3_BUCKET', 'test-bucket')
      vi.stubEnv('S3_ACCESS_KEY_ID', 'test-key')
      vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test-secret')
    })

    it('uses correct extension', async () => {
      const { generateAccommodationKey } = await import('./s3')

      expect(generateAccommodationKey('webp')).toMatch(/\.webp$/)
      expect(generateAccommodationKey('png')).toMatch(/\.png$/)
    })
  })

  describe('uploadFile', () => {
    it('uploads file and returns public URL', async () => {
      sendMock.mockResolvedValueOnce({})
      const { uploadFile } = await import('./s3')

      const url = await uploadFile({
        key: 'accommodations/abc123.jpg',
        body: Buffer.from('fake-image'),
        contentType: 'image/jpeg',
      })

      expect(sendMock).toHaveBeenCalledOnce()
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'accommodations/abc123.jpg',
          Body: Buffer.from('fake-image'),
          ContentType: 'image/jpeg',
          ACL: 'public-read',
        }),
      )
      expect(url).toBe('https://test-bucket.s3.test.example.com/accommodations/abc123.jpg')
    })
  })

  describe('deleteFile', () => {
    it('sends delete command with correct key', async () => {
      sendMock.mockResolvedValueOnce({})
      const { deleteFile } = await import('./s3')

      await deleteFile('accommodations/abc123.jpg')

      expect(sendMock).toHaveBeenCalledOnce()
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'accommodations/abc123.jpg',
        }),
      )
    })
  })
})
