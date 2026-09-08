import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { user } from '../server/db/schema/auth'
import { createOwner, createUser } from './fixtures/factories'
import { adminCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

describe('admin.users.list', () => {
  describe('unlinked filter', () => {
    it('returns users without ownerId regardless of role', async () => {
      await createUser({ id: 'user-no-owner', role: 'user', name: 'User No Owner' })
      await createUser({ id: 'owner-no-owner', role: 'owner', name: 'Owner No Owner' })
      await createUser({ id: 'admin-no-owner', role: 'admin', name: 'Admin No Owner' })

      const result = await adminCaller.admin.users.list({ unlinked: true })

      expect(result.total).toBeGreaterThanOrEqual(3)
      const ids = result.items.map((u: { id: string }) => u.id)
      expect(ids).toContain('user-no-owner')
      expect(ids).toContain('owner-no-owner')
      expect(ids).toContain('admin-no-owner')
    })

    it('excludes users that are already linked to an owner', async () => {
      await createUser({ id: 'linked-user', role: 'user', name: 'Linked User' })
      await createOwner({ userId: 'linked-user', name: 'Owner A', slug: 'owner-a' })

      await createUser({ id: 'free-user', role: 'user', name: 'Free User' })

      const result = await adminCaller.admin.users.list({ unlinked: true })

      const ids = result.items.map((u: { id: string }) => u.id)
      expect(ids).toContain('free-user')
      expect(ids).not.toContain('linked-user')
    })

    it('combines unlinked with search filter', async () => {
      await createUser({ id: 'alice-unlinked', role: 'user', name: 'Alice Dupont', email: 'alice@test.com' })
      await createUser({ id: 'bob-unlinked', role: 'user', name: 'Bob Martin', email: 'bob@test.com' })

      const result = await adminCaller.admin.users.list({ unlinked: true, search: 'Alice' })

      const ids = result.items.map((u: { id: string }) => u.id)
      expect(ids).toContain('alice-unlinked')
      expect(ids).not.toContain('bob-unlinked')
    })
  })
})

describe("plafond d'administrateurs cote administration plateforme", () => {
  it('rejects promoting a linked owner to administrator when the bailleur already has 2', async () => {
    const db = getTestDb()
    await createUser({ id: 'ceil-a1', role: 'owner', name: 'A1', email: 'ceil-a1@test.com' })
    const owner = await createOwner({ name: 'Bailleur Plafond', slug: 'bailleur-plafond', userId: 'ceil-a1' })
    await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-a1'))

    await createUser({ id: 'ceil-a2', role: 'owner', name: 'A2', email: 'ceil-a2@test.com' })
    await db.update(user).set({ ownerId: owner.id, bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-a2'))

    await createUser({ id: 'ceil-g1', role: 'owner', name: 'G1', email: 'ceil-g1@test.com' })
    await db.update(user).set({ ownerId: owner.id, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'ceil-g1'))

    await expect(adminCaller.admin.users.update({ id: 'ceil-g1', bailleurRole: 'administrator' })).rejects.toThrow(
      /ne peut compter plus de 2 administrateurs/,
    )
  })

  it('allows updating the email of an already-administrator linked owner', async () => {
    const db = getTestDb()
    await createUser({ id: 'ceil-b1', role: 'owner', name: 'B1', email: 'ceil-b1@test.com' })
    const owner = await createOwner({ name: 'Bailleur Plafond B', slug: 'bailleur-plafond-b', userId: 'ceil-b1' })
    await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-b1'))

    await createUser({ id: 'ceil-b2', role: 'owner', name: 'B2', email: 'ceil-b2@test.com' })
    await db.update(user).set({ ownerId: owner.id, bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-b2'))

    const updated = await adminCaller.admin.users.update({ id: 'ceil-b2', email: 'ceil-b2-new@test.com' })
    expect(updated?.email).toBe('ceil-b2-new@test.com')
  })

  it('skips the ceiling for a user without ownerId', async () => {
    await createUser({ id: 'ceil-free', role: 'owner', name: 'Free', email: 'ceil-free@test.com' })

    const updated = await adminCaller.admin.users.update({ id: 'ceil-free', bailleurRole: 'administrator' })
    expect(updated?.bailleurRole).toBe('administrator')
  })

  it('rejects linkToOwner of an administrator when the target bailleur is full', async () => {
    const db = getTestDb()
    await createUser({ id: 'ceil-c1', role: 'owner', name: 'C1', email: 'ceil-c1@test.com' })
    const owner = await createOwner({ name: 'Bailleur Plafond C', slug: 'bailleur-plafond-c', userId: 'ceil-c1' })
    await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-c1'))

    await createUser({ id: 'ceil-c2', role: 'owner', name: 'C2', email: 'ceil-c2@test.com' })
    await db.update(user).set({ ownerId: owner.id, bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-c2'))

    // Compte administrateur non rattache : le rattachement doit etre refuse.
    await createUser({ id: 'ceil-c3', role: 'owner', name: 'C3', email: 'ceil-c3@test.com' })
    await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-c3'))

    await expect(adminCaller.admin.users.linkToOwner({ userId: 'ceil-c3', ownerId: owner.id })).rejects.toThrow(
      /ne peut compter plus de 2 administrateurs/,
    )
  })

  it('allows linkToOwner of a gestionnaire when the target bailleur is full', async () => {
    const db = getTestDb()
    await createUser({ id: 'ceil-d1', role: 'owner', name: 'D1', email: 'ceil-d1@test.com' })
    const owner = await createOwner({ name: 'Bailleur Plafond D', slug: 'bailleur-plafond-d', userId: 'ceil-d1' })
    await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-d1'))

    await createUser({ id: 'ceil-d2', role: 'owner', name: 'D2', email: 'ceil-d2@test.com' })
    await db.update(user).set({ ownerId: owner.id, bailleurRole: 'administrator' }).where(eq(user.id, 'ceil-d2'))

    await createUser({ id: 'ceil-d3', role: 'owner', name: 'D3', email: 'ceil-d3@test.com' })
    await db.update(user).set({ bailleurRole: 'gestionnaire' }).where(eq(user.id, 'ceil-d3'))

    const linked = await adminCaller.admin.users.linkToOwner({ userId: 'ceil-d3', ownerId: owner.id })
    expect(linked?.ownerId).toBe(owner.id)
  })
})
