import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { db } from '~/server/db'
import { apikey } from '~/server/db/schema/api-key'
import { apiKeyOwners } from '~/server/db/schema/api-key-owner'
import { createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller } from './helpers/test-caller'

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

const findConsumer = async (id: string) => {
  const { items } = await adminCaller.admin.consumers.list({ page: 1 })
  return items.find((i) => i.id === id)
}

describe('admin.consumers owner link', () => {
  it('create avec ownerId : list renvoie le bailleur', async () => {
    const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', contactMode: EOwnerContactMode.CONTACTS })
    const created = await adminCaller.admin.consumers.create({ name: 'Conso', ownerId: owner!.id })
    const item = await findConsumer(created.id)
    expect(item?.owner).toEqual({ id: owner!.id, name: 'Bailleur A', contactMode: EOwnerContactMode.CONTACTS })
  })

  it('create sans ownerId : owner null', async () => {
    const created = await adminCaller.admin.consumers.create({ name: 'Conso' })
    expect((await findConsumer(created.id))?.owner).toBeNull()
  })

  it('create avec un ownerId inexistant : BAD_REQUEST', async () => {
    await expect(adminCaller.admin.consumers.create({ name: 'Conso', ownerId: 999999 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bailleur introuvable',
    })
    const { items } = await adminCaller.admin.consumers.list({ page: 1 })
    expect(items).toHaveLength(0)
  })

  it('update : ownerId change, null détache, absent laisse inchangé', async () => {
    const a = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a' })
    const b = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b' })
    const created = await adminCaller.admin.consumers.create({ name: 'Conso', ownerId: a!.id })

    await adminCaller.admin.consumers.update({ keyId: created.id, name: 'Renommé' })
    expect((await findConsumer(created.id))?.owner?.id).toBe(a!.id)

    await adminCaller.admin.consumers.update({ keyId: created.id, ownerId: b!.id })
    expect((await findConsumer(created.id))?.owner?.id).toBe(b!.id)

    await adminCaller.admin.consumers.update({ keyId: created.id, ownerId: null })
    expect((await findConsumer(created.id))?.owner).toBeNull()

    await adminCaller.admin.consumers.update({ keyId: created.id, ownerId: a!.id })
    expect((await findConsumer(created.id))?.owner?.id).toBe(a!.id)
  })

  it('update avec un ownerId inexistant : BAD_REQUEST', async () => {
    const created = await adminCaller.admin.consumers.create({ name: 'Conso' })
    await expect(adminCaller.admin.consumers.update({ keyId: created.id, ownerId: 999999 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bailleur introuvable',
    })
  })

  it('revoke supprime la ligne api_key_owner (cascade)', async () => {
    const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a' })
    const created = await adminCaller.admin.consumers.create({ name: 'Conso', ownerId: owner!.id })
    expect(await db.select().from(apiKeyOwners).where(eq(apiKeyOwners.apiKeyId, created.id))).toHaveLength(1)

    await adminCaller.admin.consumers.revoke({ keyId: created.id })

    expect(await db.select().from(apikey).where(eq(apikey.id, created.id))).toHaveLength(0)
    expect(await db.select().from(apiKeyOwners).where(eq(apiKeyOwners.apiKeyId, created.id))).toHaveLength(0)
  })
})
