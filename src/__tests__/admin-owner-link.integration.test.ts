import { beforeEach, describe, expect, it } from 'vitest'
import { createAdminOwnerLink, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, ownerCaller } from './helpers/test-caller'

beforeEach(async () => {
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Test Owner 2', email: 'owner2@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

describe('owner cannot use admin-owner link tRPC endpoints', () => {
  it('rejects owner from admin.users.linkAdminToOwner', async () => {
    await expect(ownerCaller.admin.users.linkAdminToOwner({ userId: 'test-owner-id', ownerId: 1 })).rejects.toThrow('Admin role required')
  })

  it('rejects owner from admin.users.unlinkAdminFromOwner', async () => {
    await expect(ownerCaller.admin.users.unlinkAdminFromOwner({ userId: 'test-owner-id', ownerId: 1 })).rejects.toThrow(
      'Admin role required',
    )
  })

  it('rejects owner from admin.users.myLinkedOwners', async () => {
    await expect(ownerCaller.admin.users.myLinkedOwners()).rejects.toThrow('Admin role required')
  })
})

describe('owner cannot access another owner accommodations via bailleur.list', () => {
  it('owner only sees their own accommodations, not another owner', async () => {
    await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id' })
    await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'test-owner-id-2' })

    const result = await ownerCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(0)
  })
})

describe('linkAdminToOwner validates target user role', () => {
  it('rejects linking a user with role owner', async () => {
    const owner = await createOwner({ name: 'Bailleur', slug: 'bailleur-link-test' })
    await expect(adminCaller.admin.users.linkAdminToOwner({ userId: 'test-owner-id', ownerId: owner.id })).rejects.toThrow(
      "L'utilisateur doit avoir le rôle admin",
    )
  })
})

describe('admin link/unlink lifecycle', () => {
  it('admin can link to an owner and see it in myLinkedOwners', async () => {
    const owner = await createOwner({ name: 'Bailleur Lifecycle', slug: 'bailleur-lifecycle' })

    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: owner.id })

    const linked = await adminCaller.admin.users.myLinkedOwners()
    expect(linked).toHaveLength(1)
    expect(linked[0].id).toBe(owner.id)
    expect(linked[0].name).toBe('Bailleur Lifecycle')
  })

  it('admin can link to multiple owners', async () => {
    const ownerA = await createOwner({ name: 'Bailleur A', slug: 'bailleur-multi-a' })
    const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-multi-b' })

    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: ownerA.id })
    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: ownerB.id })

    const linked = await adminCaller.admin.users.myLinkedOwners()
    expect(linked).toHaveLength(2)
  })

  it('duplicate link is idempotent (no error)', async () => {
    const owner = await createOwner({ name: 'Bailleur Dup', slug: 'bailleur-dup' })

    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: owner.id })
    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: owner.id })

    const linked = await adminCaller.admin.users.myLinkedOwners()
    expect(linked).toHaveLength(1)
  })

  it('admin can unlink from an owner', async () => {
    const owner = await createOwner({ name: 'Bailleur Unlink', slug: 'bailleur-unlink' })
    await adminCaller.admin.users.linkAdminToOwner({ userId: 'test-admin-id', ownerId: owner.id })

    await adminCaller.admin.users.unlinkAdminFromOwner({ userId: 'test-admin-id', ownerId: owner.id })

    const linked = await adminCaller.admin.users.myLinkedOwners()
    expect(linked).toHaveLength(0)
  })

  it('unlink non-existent link throws NOT_FOUND', async () => {
    await expect(adminCaller.admin.users.unlinkAdminFromOwner({ userId: 'test-admin-id', ownerId: 999 })).rejects.toThrow(
      'Lien admin-gestionnaire non trouvé',
    )
  })
})

// ─── owners.getById includes admin links ───────────────────────────────────

describe('owners.getById returns admin users linked via admin_owner_link', () => {
  it('includes adminOwnerLinks in owner detail', async () => {
    const owner = await createOwner({ name: 'Bailleur Detail', slug: 'bailleur-detail' })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner.id })

    const detail = await adminCaller.admin.owners.getById({ id: owner.id })
    expect(detail.adminOwnerLinks).toHaveLength(1)
    expect(detail.adminOwnerLinks[0].user.id).toBe('test-admin-id')
    expect(detail.adminOwnerLinks[0].user.role).toBe('admin')
  })
})

// ─── users.getById includes admin owner links ──────────────────────────────

describe('users.getById returns linked owners for admin user', () => {
  it('includes adminOwnerLinks in admin user detail', async () => {
    const owner = await createOwner({ name: 'Bailleur UserDetail', slug: 'bailleur-user-detail' })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner.id })

    const detail = await adminCaller.admin.users.getById({ id: 'test-admin-id' })
    expect(detail.adminOwnerLinks).toHaveLength(1)
    expect(detail.adminOwnerLinks[0].owner.id).toBe(owner.id)
  })
})

// ─── owners.delete cleans up admin_owner_link ──────────────────────────────

describe('deleting an owner cleans up admin links', () => {
  it('removes admin_owner_link entries when owner is deleted', async () => {
    const owner = await createOwner({ name: 'Bailleur ToDelete', slug: 'bailleur-to-delete' })
    await createAdminOwnerLink({ userId: 'test-admin-id', ownerId: owner.id })

    // Verify link exists
    const before = await adminCaller.admin.users.myLinkedOwners()
    expect(before).toHaveLength(1)

    await adminCaller.admin.owners.delete({ id: owner.id })

    // Verify link is cleaned up
    const after = await adminCaller.admin.users.myLinkedOwners()
    expect(after).toHaveLength(0)
  })
})
