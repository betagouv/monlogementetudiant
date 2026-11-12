import { beforeEach, describe, expect, it } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { apiV1App } from '~/server/api/v1/app'
import { db } from '~/server/db'
import { contactRequests } from '~/server/db/schema'
import { apiKeyOwners } from '~/server/db/schema/api-key-owner'
import { auth } from '~/services/better-auth'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const BASE = '/api/v1'

let keyUserSeq = 0

/** Crée un utilisateur + une clé d'API de test, éventuellement rattachée à un bailleur. */
async function makeKey(opts: { ownerId?: number; rateLimitMax?: number } = {}) {
  const id = `key-user-${++keyUserSeq}`
  await createUser({ id, email: `${id}@test.com` })
  const created = await auth.api.createApiKey({
    body: {
      name: `consumer-${id}`,
      prefix: 'mle_',
      userId: id,
      ...(opts.rateLimitMax != null ? { rateLimitMax: opts.rateLimitMax, rateLimitTimeWindow: 60_000 } : {}),
    },
  })
  if (opts.ownerId != null) {
    await db.insert(apiKeyOwners).values({ apiKeyId: created.id, ownerId: opts.ownerId })
  }
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

beforeEach(() => {
  keyUserSeq = 0
})

describe('API v1 contacts — middleware', () => {
  it("ne facture qu'une seule fois la clé par appel à /contacts", async () => {
    const { owner } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id, rateLimitMax: 2 })
    const statuses = [(await req('/contacts', key)).status, (await req('/contacts', key)).status]
    expect(statuses).toEqual([200, 200])
  })
})

describe('API v1 contacts — résolution du bailleur', () => {
  it('refuse une requête sans clé (401)', async () => {
    const { status } = await req('/contacts')
    expect(status).toBe(401)
  })

  it('refuse une clé sans bailleur (403)', async () => {
    const { key } = await makeKey()
    const { status, body } = await req('/contacts', key)
    expect(status).toBe(403)
    expect(body.error).toBe("Cette clé d'API n'est rattachée à aucun bailleur.")
  })
})

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

type ContactInsert = typeof contactRequests.$inferInsert

async function insertContact(values: ContactInsert) {
  const [row] = await getTestDb().insert(contactRequests).values(values).returning()
  return row
}

let ownerSeq = 0

async function seedOwner(contactMode: EOwnerContactMode = EOwnerContactMode.CONTACTS) {
  ownerSeq += 1
  const owner = await createOwner({ name: `Bailleur ${ownerSeq}`, slug: `bailleur-http-${ownerSeq}`, contactMode })
  const residence = await createAccommodation({ name: `Résidence ${ownerSeq}`, ownerId: owner.id })
  return { owner, residence }
}

const contact = (accommodationId: number, overrides: Partial<ContactInsert> = {}): ContactInsert => ({
  accommodationId,
  firstname: 'Camille',
  lastname: 'Martin',
  email: `camille-${Math.random()}@test.fr`,
  phone: '0601020304',
  confirmedAt: daysAgo(1),
  createdAt: daysAgo(1),
  updatedAt: daysAgo(1),
  ...overrides,
})

describe('GET /contacts', () => {
  it('renvoie la forme ContactsResponse avec les coordonnées', async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    const row = await insertContact(contact(residence.id))

    const { status, body } = await req('/contacts', key)
    expect(status).toBe(200)
    expect(body).toMatchObject({ count: 1, next: null, previous: null, pageSize: 20 })
    const [first] = body.results as Record<string, unknown>[]
    expect(first).toMatchObject({
      id: row.id,
      status: EContactStatus.A_CONTACTER,
      purged: false,
      purgedAt: null,
      residence: { slug: residence.slug, name: residence.name, externalReference: null },
      student: { firstname: 'Camille', email: row.email, phone: '0601020304' },
    })
    expect(typeof first.createdAt).toBe('string')
  })

  it('pagine avec next/previous en numéros de page', async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    for (let i = 1; i <= 3; i++) await insertContact(contact(residence.id, { createdAt: daysAgo(i) }))

    const p1 = await req('/contacts?page_size=2', key)
    expect(p1.body).toMatchObject({ count: 3, next: '2', previous: null, pageSize: 2 })
    expect(p1.body.results).toHaveLength(2)
    const p2 = await req('/contacts?page_size=2&page=2', key)
    expect(p2.body).toMatchObject({ next: null, previous: '1' })
    expect(p2.body.results).toHaveLength(1)
  })

  it('filtre par statut', async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    await insertContact(contact(residence.id, { status: EContactStatus.CONTACTE }))
    await insertContact(contact(residence.id))

    const { body } = await req('/contacts?status=contacte', key)
    expect(body.count).toBe(1)
  })

  it('include_purged renvoie les demandes anciennes sans données personnelles', async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    await insertContact(contact(residence.id, { createdAt: daysAgo(40), confirmedAt: daysAgo(40) }))

    expect((await req('/contacts', key)).body.count).toBe(0)
    const { body } = await req('/contacts?include_purged=true', key)
    expect(body.count).toBe(1)
    expect((body.results as Record<string, unknown>[])[0]).toMatchObject({ purged: true, student: null })
  })

  it("réduit une demande ancienne liée à un compte, sans fuite du nom ni de l'e-mail du compte", async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    await createUser({
      id: 'account-leak',
      email: 'zorglub.secret@test.com',
      name: 'Zorglub Secretnom',
      firstname: 'Zorglub',
      lastname: 'Secretnom',
    })
    const row = await insertContact({
      accommodationId: residence.id,
      userId: 'account-leak',
      confirmedAt: daysAgo(40),
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    })

    const list = await req('/contacts?include_purged=true', key)
    expect((list.body.results as Record<string, unknown>[])[0]).toMatchObject({ id: row.id, purged: true, student: null })
    const detail = await req(`/contacts/${row.id}`, key)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ purged: true, student: null })
    for (const body of [list.body, detail.body]) {
      const json = JSON.stringify(body)
      expect(json).not.toContain('Zorglub')
      expect(json).not.toContain('Secretnom')
      expect(json).not.toContain('zorglub.secret')
    }
  })

  it('liste vide et détail 404 si le bailleur est passé en mode dossier_facile', async () => {
    const { owner, residence } = await seedOwner(EOwnerContactMode.DOSSIER_FACILE)
    const { key } = await makeKey({ ownerId: owner.id })
    const row = await insertContact(contact(residence.id))

    expect((await req('/contacts', key)).body.count).toBe(0)
    expect((await req(`/contacts/${row.id}`, key)).status).toBe(404)
  })

  it.each([['status=foo'], ['page_size=101'], ['created_since=hier'], ['order=up']])('rejette %s en 400 JSON', async (qs) => {
    const { owner } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    const { status, body } = await req(`/contacts?${qs}`, key)
    expect(status).toBe(400)
    expect(typeof body.error).toBe('string')
  })
})

describe('GET /contacts/{id}', () => {
  it('renvoie le détail', async () => {
    const { owner, residence } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    const row = await insertContact(contact(residence.id))

    const { status, body } = await req(`/contacts/${row.id}`, key)
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: row.id, purged: false, student: { email: row.email } })
  })

  it("renvoie 404 pour la demande d'un autre bailleur, identique à un id inconnu", async () => {
    const mine = await seedOwner()
    const other = await seedOwner()
    const { key } = await makeKey({ ownerId: mine.owner.id })
    const row = await insertContact(contact(other.residence.id))

    const foreign = await req(`/contacts/${row.id}`, key)
    const unknown = await req('/contacts/00000000-0000-4000-8000-000000000000', key)
    expect(foreign.status).toBe(404)
    expect(foreign).toEqual(unknown)
    expect(foreign.body).toEqual({ error: 'Demande introuvable.' })
  })

  it('renvoie 400 pour un id non UUID', async () => {
    const { owner } = await seedOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    const { status, body } = await req('/contacts/pas-un-uuid', key)
    expect(status).toBe(400)
    expect(typeof body.error).toBe('string')
  })
})

describe('GET /openapi.json', () => {
  it('documente les endpoints contacts avec le tag et la réponse 403', async () => {
    const res = await apiV1App.request(`${BASE}/openapi.json`)
    const doc = (await res.json()) as {
      info: { description: string }
      paths: Record<string, { get: { tags: string[]; responses: Record<string, unknown> } }>
    }
    for (const path of ['/api/v1/contacts', '/api/v1/contacts/{id}']) {
      expect(doc.paths[path].get.tags).toEqual(['Demandes de contact'])
      expect(doc.paths[path].get.responses['403']).toBeDefined()
    }
    expect(doc.paths['/api/v1/contacts/{id}'].get.responses['404']).toBeDefined()
    expect(doc.info.description).toContain('demandes de contact')
  })
})
