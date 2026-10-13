import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { apiV1App } from '~/server/api/v1/app'
import { db } from '~/server/db'
import { apikey } from '~/server/db/schema/api-key'
import { account } from '~/server/db/schema/auth'
import { departments } from '~/server/db/schema/departments'
import { env } from '~/server/env'
import { auth } from '~/services/better-auth'
import {
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createExternalSource,
  createOwner,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller } from './helpers/test-caller'

const BASE = '/api/v1'

let keyUserSeq = 0

/** Crée un utilisateur + une clé d'API de test, renvoie la clé en clair et son id. */
async function makeKey(opts: { rateLimitMax?: number; rateLimitTimeWindow?: number } = {}) {
  const id = `key-user-${++keyUserSeq}`
  await createUser({ id, email: `${id}@test.com` })
  const created = await auth.api.createApiKey({
    body: {
      name: `consumer-${id}`,
      prefix: 'mle_',
      userId: id,
      ...(opts.rateLimitMax != null ? { rateLimitMax: opts.rateLimitMax } : {}),
      ...(opts.rateLimitTimeWindow != null ? { rateLimitTimeWindow: opts.rateLimitTimeWindow } : {}),
    },
  })
  return { key: created.key, id: created.id }
}

async function req(path: string, key?: string) {
  const res = await apiV1App.request(BASE + path, { headers: key ? { 'x-api-key': key } : {} })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body: body as Record<string, unknown> }
}

/** Polygone carré (MultiPolygon) centré sur un point, pour les filtres ST_Within. */
const square = (lng: number, lat: number, d = 0.05) => ({
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  ],
})

beforeEach(() => {
  keyUserSeq = 0
})

describe('API v1 — autorisation par clé', () => {
  it('refuse une requête sans clé (401)', async () => {
    const res = await req('/accommodations')
    expect(res.status).toBe(401)
    expect(res.body.error).toBeTruthy()
  })

  it('refuse une clé invalide (401)', async () => {
    const res = await req('/accommodations', 'mle_cle-bidon')
    expect(res.status).toBe(401)
  })

  it('refuse une clé désactivée (401)', async () => {
    const { key, id } = await makeKey()
    await db.update(apikey).set({ enabled: false }).where(eq(apikey.id, id))
    const res = await req('/cities', key)
    expect(res.status).toBe(401)
  })

  it('accepte une clé valide (200)', async () => {
    const { key } = await makeKey()
    const res = await req('/cities', key)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('laisse passer /openapi.json sans clé (200)', async () => {
    const res = await req('/openapi.json')
    expect(res.status).toBe(200)
    expect((res.body as { openapi?: string }).openapi).toBe('3.1.0')
  })
})

describe('API v1 — rate limit', () => {
  it('renvoie 429 quand le quota par clé est dépassé', async () => {
    const { key } = await makeKey({ rateLimitMax: 2, rateLimitTimeWindow: 60_000 })
    const r1 = await req('/cities', key)
    const r2 = await req('/cities', key)
    const r3 = await req('/cities', key)
    expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 429])
    expect(r3.body.error).toBeTruthy()
  })

  it("incrémente le compteur d'usage de la clé (attribution)", async () => {
    const { key, id } = await makeKey()
    await req('/cities', key)
    await req('/departments', key)
    await req('/academies', key)
    const [row] = await db.select({ requestCount: apikey.requestCount }).from(apikey).where(eq(apikey.id, id))
    expect(row?.requestCount).toBeGreaterThanOrEqual(3)
  })
})

describe('API v1 — flux de données (iso carte)', () => {
  it('ne renvoie que les résidences publiées avec géométrie', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'pub-geom', published: true, geom: { type: 'Point', coordinates: [4.39, 45.44] } })
    await createAccommodation({ slug: 'unpublished', published: false, geom: { type: 'Point', coordinates: [4.39, 45.44] } })
    await createAccommodation({ slug: 'no-geom', published: true })

    const res = await req('/accommodations?page_size=50', key)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    const results = res.body.results as Array<{ slug: string }>
    expect(results[0].slug).toBe('pub-geom')
  })

  it('filtre par city_slugs (ST_Within, iso carte)', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Académie Test City' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Dép Test' })
    const city = await createCity({ departmentId: department.id, name: 'Testville', slug: 'testville', boundary: square(2.35, 48.85) })

    await createAccommodation({ slug: 'in-testville', cityId: city.id, geom: { type: 'Point', coordinates: [2.35, 48.85] } })
    await createAccommodation({ slug: 'far-away', geom: { type: 'Point', coordinates: [7.75, 48.58] } })

    const res = await req('/accommodations?city_slugs=testville&page_size=50', key)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    const results = res.body.results as Array<{ slug: string }>
    expect(results[0].slug).toBe('in-testville')
  })

  it('filtre par postal_codes (attributaire)', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'pc-75', postalCode: '75001', geom: { type: 'Point', coordinates: [2.35, 48.85] } })
    await createAccommodation({ slug: 'pc-69', postalCode: '69001', geom: { type: 'Point', coordinates: [4.83, 45.77] } })

    const res = await req('/accommodations?postal_codes=75001&page_size=50', key)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    const results = res.body.results as Array<{ postalCode: string }>
    expect(results[0].postalCode).toBe('75001')
  })

  it('renvoie le détail avec updatedAt en string ISO', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'detail-me', geom: { type: 'Point', coordinates: [2.35, 48.85] } })

    const res = await req('/accommodations/detail-me', key)
    expect(res.status).toBe(200)
    expect(typeof res.body.updatedAt).toBe('string')
    expect(() => new Date(res.body.updatedAt as string).toISOString()).not.toThrow()
  })

  it('renvoie 404 pour un slug inexistant', async () => {
    const { key } = await makeKey()
    const res = await req('/accommodations/slug-inexistant', key)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })
})

const count = (res: { body: Record<string, unknown> }) => res.body.count as number
const slugs = (res: { body: Record<string, unknown> }) => (res.body.results as Array<{ slug: string }>).map((f) => f.slug)

const PARIS: [number, number] = [2.35, 48.85]
const LYON: [number, number] = [4.83, 45.77]
const STRASBOURG: [number, number] = [7.75, 48.58]

describe('API v1 — filtres', () => {
  it('filtre par price_max (priceMin <= max)', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'cheap', priceMin: 400, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'pricey', priceMin: 800, geom: { type: 'Point', coordinates: PARIS } })
    const res = await req('/accommodations?price_max=500&page_size=50', key)
    expect(count(res)).toBe(1)
    expect(slugs(res)).toEqual(['cheap'])
  })

  it('filtre crous en tri-état (absent = tout, true = CROUS, false = hors CROUS)', async () => {
    const { key } = await makeKey()
    const crous = await createAccommodation({ slug: 'crous-yes', geom: { type: 'Point', coordinates: PARIS } })
    await createExternalSource({ accommodationId: crous.id, source: 'crous' })
    await createAccommodation({ slug: 'crous-no', geom: { type: 'Point', coordinates: [2.36, 48.85] } })

    expect(slugs(await req('/accommodations?crous=true&page_size=50', key))).toEqual(['crous-yes'])
    expect(slugs(await req('/accommodations?crous=false&page_size=50', key))).toEqual(['crous-no'])
    expect(count(await req('/accommodations?page_size=50', key))).toBe(2)
  })

  it('filtre accessible (PMR)', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'pmr', nbAccessibleApartments: 3, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'no-pmr', nbAccessibleApartments: 0, geom: { type: 'Point', coordinates: PARIS } })
    expect(slugs(await req('/accommodations?accessible=true&page_size=50', key))).toEqual(['pmr'])
  })

  it('filtre coliving', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'coloc', nbColivingApartments: 2, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'no-coloc', nbColivingApartments: 0, geom: { type: 'Point', coordinates: PARIS } })
    expect(slugs(await req('/accommodations?coliving=true&page_size=50', key))).toEqual(['coloc'])
  })

  it('filtre available (disponibilités)', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'dispo', nbAvailableApartments: 2, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'no-dispo', geom: { type: 'Point', coordinates: PARIS } })
    expect(slugs(await req('/accommodations?available=true&page_size=50', key))).toEqual(['dispo'])
  })

  it('filtre owner_slug', async () => {
    const { key } = await makeKey()
    const owner = await createOwner({ slug: 'mon-bailleur', name: 'Mon Bailleur' })
    await createAccommodation({ slug: 'chez-bailleur', ownerId: owner.id, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'autre-bailleur', geom: { type: 'Point', coordinates: PARIS } })
    expect(slugs(await req('/accommodations?owner_slug=mon-bailleur&page_size=50', key))).toEqual(['chez-bailleur'])
  })

  it('filtre par bbox', async () => {
    const { key } = await makeKey()
    await createAccommodation({ slug: 'in-bbox', geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'out-bbox', geom: { type: 'Point', coordinates: STRASBOURG } })
    expect(slugs(await req('/accommodations?bbox=2.0,48.5,3.0,49.0&page_size=50', key))).toEqual(['in-bbox'])
  })

  it('filtre par academie (slug, ST_Within)', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Académie de Paris', slug: 'paris-acad', boundary: square(...PARIS) })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris' })
    const city = await createCity({ departmentId: department.id, slug: 'paris-ville', boundary: square(...PARIS) })
    await createAccommodation({ slug: 'in-acad', cityId: city.id, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'out-acad', geom: { type: 'Point', coordinates: STRASBOURG } })
    expect(slugs(await req('/accommodations?academie=paris-acad&page_size=50', key))).toEqual(['in-acad'])
  })

  it('filtre par département (code ou slug, ST_Within)', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Acad Dép' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris', slug: 'dep-paris' })
    // createDepartment ne pose pas la boundary : on la définit ici pour le filtre géométrique.
    await db
      .update(departments)
      .set({ boundary: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(square(...PARIS))}), 4326)` })
      .where(eq(departments.id, department.id))
    const city = await createCity({ departmentId: department.id, slug: 'dep-paris-ville', boundary: square(...PARIS) })
    await createAccommodation({ slug: 'in-dep', cityId: city.id, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'out-dep', geom: { type: 'Point', coordinates: STRASBOURG } })

    expect(slugs(await req('/accommodations?department=75&page_size=50', key))).toEqual(['in-dep'])
    expect(slugs(await req('/accommodations?department=dep-paris&page_size=50', key))).toEqual(['in-dep'])
  })

  it('combine plusieurs villes en union (OR)', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Acad Multi' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Multi' })
    const paris = await createCity({ departmentId: department.id, slug: 'ville-paris', boundary: square(...PARIS) })
    const lyon = await createCity({ departmentId: department.id, slug: 'ville-lyon', boundary: square(...LYON) })
    await createAccommodation({ slug: 'a-paris', cityId: paris.id, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'a-lyon', cityId: lyon.id, geom: { type: 'Point', coordinates: LYON } })
    await createAccommodation({ slug: 'a-strasbourg', geom: { type: 'Point', coordinates: STRASBOURG } })

    const res = await req('/accommodations?city_slugs=ville-paris,ville-lyon&page_size=50', key)
    expect(count(res)).toBe(2)
    expect(slugs(res).sort()).toEqual(['a-lyon', 'a-paris'])
  })

  it('combine localisation ET filtre commun (price_max)', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Acad AND' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'AND' })
    const city = await createCity({ departmentId: department.id, slug: 'ville-and', boundary: square(...PARIS) })
    await createAccommodation({ slug: 'and-cheap', cityId: city.id, priceMin: 400, geom: { type: 'Point', coordinates: PARIS } })
    await createAccommodation({ slug: 'and-pricey', cityId: city.id, priceMin: 900, geom: { type: 'Point', coordinates: PARIS } })

    expect(slugs(await req('/accommodations?city_slugs=ville-and&price_max=500&page_size=50', key))).toEqual(['and-cheap'])
  })

  it('pagine (page_size, next, page 2)', async () => {
    const { key } = await makeKey()
    for (const s of ['pg-1', 'pg-2', 'pg-3']) {
      await createAccommodation({ slug: s, geom: { type: 'Point', coordinates: PARIS } })
    }
    const p1 = await req('/accommodations?page_size=2', key)
    expect(count(p1)).toBe(3)
    expect(slugs(p1).length).toBe(2)
    expect(p1.body.next).toBe('2')
    expect(p1.body.previous).toBeNull()

    const p2 = await req('/accommodations?page_size=2&page=2', key)
    expect(slugs(p2).length).toBe(1)
    expect(p2.body.previous).toBe('1')
    expect(p2.body.next).toBeNull()
  })
})

const names = (res: { body: Record<string, unknown> }) => (res.body as unknown as Array<{ name: string }>).map((r) => r.name)

describe('API v1 — recherche territoires par nom (search)', () => {
  it('cherche les villes par nom', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Acad Search' })
    const department = await createDepartment({ academyId: academy.id, code: '38', name: 'Isère' })
    await createCity({ departmentId: department.id, name: 'Grenoble', slug: 'grenoble-s' })
    await createCity({ departmentId: department.id, name: 'Lyon', slug: 'lyon-s' })

    const res = await req('/cities?search=greno', key)
    expect(res.status).toBe(200)
    expect(names(res)).toEqual(['Grenoble'])
  })

  it('cherche les départements par nom', async () => {
    const { key } = await makeKey()
    const academy = await createAcademy({ name: 'Acad Search Dep' })
    await createDepartment({ academyId: academy.id, code: '38', name: 'Isère' })
    await createDepartment({ academyId: academy.id, code: '75', name: 'Paris' })

    const res = await req('/departments?search=isè', key)
    expect(res.status).toBe(200)
    expect(names(res)).toEqual(['Isère'])
  })

  it('cherche les académies par nom', async () => {
    const { key } = await makeKey()
    await createAcademy({ name: 'Académie de Grenoble', slug: 'acad-gre' })
    await createAcademy({ name: 'Académie de Lyon', slug: 'acad-lyon' })

    const res = await req('/academies?search=grenoble', key)
    expect(res.status).toBe(200)
    expect(names(res)).toEqual(['Académie de Grenoble'])
  })
})

describe("API v1 — statistiques d'usage", () => {
  it('agrège le nombre de requêtes par jour et par consommateur', async () => {
    const { key, id } = await makeKey()
    await req('/cities', key)
    await req('/departments', key)
    await req('/academies', key)

    const usage = await adminCaller.admin.consumers.usage({ keyId: id, days: 30 })
    expect(usage.total).toBe(3)
    expect(usage.daily).toHaveLength(1)
    expect(usage.daily[0].count).toBe(3)
  })

  it('expose le total sur 30 jours dans la liste admin', async () => {
    const { key, id } = await makeKey()
    await req('/cities', key)
    await req('/cities', key)

    const list = await adminCaller.admin.consumers.list({ page: 1 })
    expect(list.items.find((item) => item.id === id)?.usage30d).toBe(2)
  })
})

describe('API v1 — admin consumers update', () => {
  it('ne modifie que les champs fournis (les autres restent inchangés)', async () => {
    const { id } = await makeKey({ rateLimitMax: 50, rateLimitTimeWindow: 60_000 })

    await adminCaller.admin.consumers.update({ keyId: id, name: 'Renommé' })

    const [row] = await db.select({ name: apikey.name, rateLimitMax: apikey.rateLimitMax }).from(apikey).where(eq(apikey.id, id))
    expect(row?.name).toBe('Renommé')
    expect(row?.rateLimitMax).toBe(50)
  })
})

describe('API v1 — création de clés réservée au back-office', () => {
  async function signInStudentOverHttp() {
    const email = 'student-api-key@test.com'
    const password = 'correctPassword123!'
    await createUser({ id: 'student-api-key', email, emailVerified: true, role: 'user' })
    await db.insert(account).values({
      id: 'account-student-api-key',
      userId: 'student-api-key',
      accountId: 'student-api-key',
      issuer: createLocalAccountIssuer('credential'),
      providerId: 'credential',
      password: await hashPassword(password),
    })
    const res = await auth.handler(
      new Request(`${env.BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: env.BASE_URL },
        body: JSON.stringify({ email, password }),
      }),
    )
    expect(res.status).toBe(200)
    return res.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ')
  }

  it.each(['create', 'list', 'get', 'update', 'delete'])('refuse /api-key/%s en HTTP à un compte connecté', async (action) => {
    const cookie = await signInStudentOverHttp()

    const res = await auth.handler(
      new Request(`${env.BASE_URL}/api/auth/api-key/${action}`, {
        method: action === 'list' || action === 'get' ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', origin: env.BASE_URL, cookie },
        body: action === 'list' || action === 'get' ? undefined : JSON.stringify({ name: 'test', keyId: 'x' }),
      }),
    )

    expect(res.status).toBe(404)
    const keys = await db.select({ id: apikey.id }).from(apikey).where(eq(apikey.referenceId, 'student-api-key'))
    expect(keys).toHaveLength(0)
  })
})
