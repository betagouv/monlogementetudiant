import { beforeEach, describe, expect, it } from 'vitest'
import { apiV1App } from '~/server/api/v1/app'
import { db } from '~/server/db'
import { apiKeyOwners } from '~/server/db/schema/api-key-owner'
import { auth } from '~/services/better-auth'
import { createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'

const BASE = '/api/v1'

let keyUserSeq = 0

/** Crée un utilisateur + une clé d'API de test, éventuellement rattachée à un bailleur. */
async function makeKey(opts: { ownerId?: number } = {}) {
  const id = `key-user-${++keyUserSeq}`
  await createUser({ id, email: `${id}@test.com` })
  const created = await auth.api.createApiKey({
    body: { name: `consumer-${id}`, prefix: 'mle_', userId: id },
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

  it('laisse passer une clé rattachée à un bailleur', async () => {
    const owner = await createOwner()
    const { key } = await makeKey({ ownerId: owner.id })
    const { status } = await req('/contacts', key)
    expect(status).not.toBe(403)
    expect(status).not.toBe(401)
  })
})
