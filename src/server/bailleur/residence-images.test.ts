import { beforeEach, describe, expect, it, vi } from 'vitest'

const s3 = vi.hoisted(() => ({
  uploaded: [] as string[],
  deleted: [] as string[],
  failOnUploadNumber: null as number | null,
}))

vi.mock('~/server/services/s3', () => {
  let counter = 0
  return {
    generateAccommodationKey: (ext: string) => `accommodations/key-${++counter}.${ext}`,
    uploadFile: async ({ key }: { key: string }) => {
      if (s3.failOnUploadNumber === s3.uploaded.length + 1) throw new Error('S3 indisponible')
      s3.uploaded.push(key)
      return `https://bucket.s3.example.com/${key}`
    },
    deleteFile: async (key: string) => {
      s3.deleted.push(key)
    },
  }
})

const { ResidenceImagesError, storeResidenceImages } = await import('./residence-images')

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
const jpeg = (name: string) => new File([new Uint8Array(JPEG_BYTES)], name, { type: 'image/jpeg' })

beforeEach(() => {
  s3.uploaded.length = 0
  s3.deleted.length = 0
  s3.failOnUploadNumber = null
})

describe('storeResidenceImages', () => {
  it('efface les fichiers envoyés quand la persistance échoue', async () => {
    const persist = async () => {
      throw new Error('base indisponible')
    }

    await expect(storeResidenceImages([jpeg('a.jpg'), jpeg('b.jpg')], persist)).rejects.toThrow('base indisponible')

    expect(s3.uploaded).toHaveLength(2)
    expect(s3.deleted.sort()).toEqual([...s3.uploaded].sort())
  })

  it("efface les fichiers déjà envoyés et ne persiste rien quand l'envoi échoue en cours de route", async () => {
    s3.failOnUploadNumber = 2
    const persist = vi.fn(async () => undefined)

    await expect(storeResidenceImages([jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg')], persist)).rejects.toThrow('S3 indisponible')

    expect(persist).not.toHaveBeenCalled()
    expect(s3.uploaded).toHaveLength(1)
    expect(s3.deleted).toEqual(s3.uploaded)
  })

  it("persiste les URLs dans l'ordre des fichiers", async () => {
    const urls = await storeResidenceImages([jpeg('a.jpg'), jpeg('b.jpg')], async (u) => u)

    expect(urls).toEqual(s3.uploaded.map((key) => `https://bucket.s3.example.com/${key}`))
    expect(s3.deleted).toEqual([])
  })

  it.each([
    ['un contenu qui n’est pas une image', [new File([new Uint8Array(12)], 'fake.jpg', { type: 'image/jpeg' })]],
    ['un type déclaré non accepté', [new File([new Uint8Array(JPEG_BYTES)], 'doc.pdf', { type: 'application/pdf' })]],
    ['un fichier de plus de 10 Mo', [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })]],
    ['plus de 10 fichiers', Array.from({ length: 11 }, (_, i) => jpeg(`${i}.jpg`))],
    ['aucun fichier', []],
  ])('refuse %s sans rien envoyer', async (_, files) => {
    const persist = vi.fn(async () => undefined)

    await expect(storeResidenceImages(files, persist)).rejects.toBeInstanceOf(ResidenceImagesError)

    expect(persist).not.toHaveBeenCalled()
    expect(s3.uploaded).toEqual([])
  })
})
