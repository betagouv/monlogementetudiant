import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accommodations } from '../server/db/schema/accommodations'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const state = vi.hoisted(() => ({
  session: null as unknown,
  uploaded: [] as string[],
  deleted: [] as string[],
  failOnUploadNumber: null as number | null,
}))

vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return { ...actual, getServerSession: async () => state.session }
})

vi.mock('~/server/services/s3', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/s3')>('~/server/services/s3')
  let counter = 0
  return {
    ...actual,
    generateAccommodationKey: (ext: string) => `accommodations/new-${++counter}.${ext}`,
    uploadFile: async ({ key }: { key: string }) => {
      if (state.failOnUploadNumber === state.uploaded.length + 1) throw new Error('S3 indisponible')
      state.uploaded.push(key)
      return `https://test-bucket.s3.example.com/${key}`
    },
    deleteFile: async (key: string) => {
      state.deleted.push(key)
    },
  }
})

const { POST: upload } = await import('~/app/api/accommodations/my/[slug]/upload/route')
const { POST: createWithImages } = await import('~/app/api/accommodations/my/route')

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
const jpeg = (name: string) => new File([new Uint8Array(JPEG_BYTES)], name, { type: 'image/jpeg' })

const EXISTING = 'https://test-bucket.s3.example.com/accommodations/existing.jpg'
const PHOTO_A = 'https://test-bucket.s3.example.com/accommodations/a.jpg'
const PHOTO_B = 'https://test-bucket.s3.example.com/accommodations/b.jpg'

const ownerSession = (ownerId: number) => ({
  session: { id: 'session-owner' },
  user: { id: 'test-owner-id', role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [], owner: { id: ownerId } },
})

const multipartRequest = async (url: string, form: FormData) => {
  const encoded = new Response(form)
  const body = new Uint8Array(await encoded.arrayBuffer())
  return new Request(url, {
    method: 'POST',
    body,
    headers: { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(body.byteLength) },
  })
}

const uploadRequest = async (slug: string, files: File[]) => {
  const form = new FormData()
  files.forEach((file) => form.append('images', file))
  const request = await multipartRequest(`http://localhost:3000/api/accommodations/my/${slug}/upload/`, form)
  return upload(request, { params: Promise.resolve({ slug }) })
}

const imagesOf = async (id: number) => {
  const [row] = await getTestDb().select({ imagesUrls: accommodations.imagesUrls }).from(accommodations).where(eq(accommodations.id, id))
  return row.imagesUrls
}

let ownerId: number
let residence: { id: number; slug: string }

beforeEach(async () => {
  state.uploaded.length = 0
  state.deleted.length = 0
  state.failOnUploadNumber = null
  await createUser({ id: 'test-owner-id', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id' })
  ownerId = owner.id
  residence = await createAccommodation({ name: 'Résidence A', ownerId, imagesUrls: [EXISTING] })
  state.session = ownerSession(ownerId)
})

describe('ajout de photos à une résidence existante', () => {
  it('enregistre les nouvelles photos à la suite des existantes, sans second appel', async () => {
    const res = await uploadRequest(residence.slug, [jpeg('a.jpg'), jpeg('b.jpg')])

    expect(res.status).toBe(200)
    expect(state.uploaded).toHaveLength(2)
    expect(await imagesOf(residence.id)).toEqual([EXISTING, ...state.uploaded.map((key) => `https://test-bucket.s3.example.com/${key}`)])
  })
})

describe("contrôle d'accès à l'ajout de photos", () => {
  it("refuse l'ajout de photos à la résidence d'un autre bailleur", async () => {
    const other = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b' })
    const foreign = await createAccommodation({ name: 'Résidence B', ownerId: other.id, imagesUrls: [] })

    const res = await uploadRequest(foreign.slug, [jpeg('a.jpg')])

    expect(res.status).toBe(404)
    expect(state.uploaded).toEqual([])
    expect(await imagesOf(foreign.id)).toEqual([])
  })
})

describe('réordonnancement des photos', () => {
  beforeEach(async () => {
    await getTestDb()
      .update(accommodations)
      .set({ imagesUrls: [EXISTING, PHOTO_A, PHOTO_B] })
      .where(eq(accommodations.id, residence.id))
  })

  it('enregistre le nouvel ordre', async () => {
    await ownerCaller.bailleur.reorderImages({ slug: residence.slug, imagesUrls: [PHOTO_B, EXISTING, PHOTO_A] })

    expect(await imagesOf(residence.id)).toEqual([PHOTO_B, EXISTING, PHOTO_A])
  })

  it.each([
    ['une photo étrangère', [PHOTO_B, EXISTING, 'https://evil.example/x.jpg']],
    ['une photo en moins', [PHOTO_B, EXISTING]],
    ['une photo en double', [PHOTO_B, PHOTO_B, EXISTING]],
  ])('refuse une liste contenant %s', async (_, imagesUrls) => {
    await expect(ownerCaller.bailleur.reorderImages({ slug: residence.slug, imagesUrls })).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect(await imagesOf(residence.id)).toEqual([EXISTING, PHOTO_A, PHOTO_B])
  })
})

describe("suppression d'une photo", () => {
  const LEGACY = 'https://legacy.example.org/old.jpg'

  beforeEach(async () => {
    await getTestDb()
      .update(accommodations)
      .set({ imagesUrls: [EXISTING, PHOTO_A, LEGACY] })
      .where(eq(accommodations.id, residence.id))
  })

  it('retire la photo de la résidence et efface son fichier du bucket', async () => {
    await ownerCaller.bailleur.removeImage({ slug: residence.slug, imageUrl: PHOTO_A })

    expect(await imagesOf(residence.id)).toEqual([EXISTING, LEGACY])
    expect(state.deleted).toEqual(['accommodations/a.jpg'])
  })

  it('retire une photo hébergée hors de notre bucket sans rien effacer', async () => {
    await ownerCaller.bailleur.removeImage({ slug: residence.slug, imageUrl: LEGACY })

    expect(await imagesOf(residence.id)).toEqual([EXISTING, PHOTO_A])
    expect(state.deleted).toEqual([])
  })

  it("refuse une photo qui n'appartient pas à la résidence", async () => {
    await expect(
      ownerCaller.bailleur.removeImage({ slug: residence.slug, imageUrl: 'https://test-bucket.s3.example.com/accommodations/other.jpg' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect(await imagesOf(residence.id)).toEqual([EXISTING, PHOTO_A, LEGACY])
    expect(state.deleted).toEqual([])
  })
})

describe('mise à jour générale de la résidence', () => {
  it('ne modifie pas les photos', async () => {
    await ownerCaller.bailleur.update({
      slug: residence.slug,
      name: 'Résidence A',
      imagesUrls: ['https://evil.example/x.jpg'],
    } as Parameters<typeof ownerCaller.bailleur.update>[0])

    expect(await imagesOf(residence.id)).toEqual([EXISTING])
  })
})

describe('création d’une résidence avec ses photos', () => {
  const payload = {
    name: 'Résidence Nouvelle',
    externalUrl: 'https://example.com',
    addresses: [{ address: '1 rue de la Paix', city: 'Paris', postalCode: '75001' }],
    typologies: [{ type: 't1', priceMin: 400, priceMax: 500, colocation: false, nbTotal: 10, nbAvailable: 2 }],
  }

  const createRequest = async (body: unknown, files: File[]) => {
    const form = new FormData()
    form.append('payload', JSON.stringify(body))
    files.forEach((file) => form.append('images', file))
    return createWithImages(await multipartRequest('http://localhost:3000/api/accommodations/my/', form))
  }

  const residenceSlugs = async () => (await getTestDb().select({ slug: accommodations.slug }).from(accommodations)).map((r) => r.slug)

  it('crée la résidence avec ses photos dans l’ordre envoyé', async () => {
    const res = await createRequest(payload, [jpeg('premiere.jpg'), jpeg('seconde.jpg')])

    expect(res.status).toBe(200)
    const { slug } = await res.json()
    const [created] = await getTestDb()
      .select({ imagesUrls: accommodations.imagesUrls })
      .from(accommodations)
      .where(eq(accommodations.slug, slug))
    expect(state.uploaded).toHaveLength(2)
    expect(created.imagesUrls).toEqual(state.uploaded.map((key) => `https://test-bucket.s3.example.com/${key}`))
  })

  it("ne crée rien et efface les photos envoyées quand l'envoi échoue", async () => {
    state.failOnUploadNumber = 2

    const res = await createRequest(payload, [jpeg('premiere.jpg'), jpeg('seconde.jpg')])

    expect(res.status).toBe(500)
    expect(await residenceSlugs()).toEqual([residence.slug])
    expect(state.deleted).toEqual(state.uploaded)
  })

  it('refuse un formulaire invalide sans rien envoyer', async () => {
    const res = await createRequest({ ...payload, typologies: [] }, [jpeg('premiere.jpg')])

    expect(res.status).toBe(400)
    expect(state.uploaded).toEqual([])
    expect(await residenceSlugs()).toEqual([residence.slug])
  })
})
