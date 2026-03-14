import { describe, expect, it } from 'vitest'
import { createOwner, createUser } from './fixtures/factories'
import { adminCaller } from './helpers/test-caller'
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
