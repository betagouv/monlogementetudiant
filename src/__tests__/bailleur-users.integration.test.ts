import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { user } from '../server/db/schema/auth'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

// Mock magic-link email to avoid hitting Brevo during tests.
vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return {
    ...actual,
    auth: {
      ...actual.auth,
      api: {
        ...actual.auth.api,
        signInMagicLink: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
})

vi.mock('next/headers', () => ({ headers: () => new Headers() }))

beforeEach(async () => {
  const db = getTestDb()
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-owner-id-2', name: 'Test Owner 2', email: 'owner2@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })

  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id' })
  const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'test-owner-id-2' })

  // Administrator is the current user
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: owner.id }).where(eq(user.id, 'test-owner-id'))
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: ownerB.id }).where(eq(user.id, 'test-owner-id-2'))
})

describe('bailleur.users.list', () => {
  it('rejects unauthenticated users', async () => {
    await expect(caller.bailleur.users.list({})).rejects.toThrow('UNAUTHORIZED')
  })

  it('rejects students (role=user)', async () => {
    await expect(authenticatedCaller.bailleur.users.list({})).rejects.toThrow('Owner or admin role required')
  })

  it('rejects gestionnaire without manage_users permission', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-no-perm', name: 'G', email: 'g@test.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'gest-no-perm'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-no-perm', email: 'g@test.com', permissions: ['manage_residences'] })

    await expect(gestCaller.bailleur.users.list({})).rejects.toThrow(/Permission denied|FORBIDDEN/)
  })

  it('returns only users of the current bailleur (with role=owner)', async () => {
    const db = getTestDb()
    // User rattache au bailleur A
    await createUser({ id: 'user-a1', name: 'Alice', email: 'alice@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'user-a1'))

    // User rattache au bailleur B (ne doit pas apparaitre)
    await createUser({ id: 'user-b1', name: 'Bob', email: 'bob@b.com', role: 'owner' })
    await db.update(user).set({ ownerId: 2, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'user-b1'))

    const result = await ownerCaller.bailleur.users.list({})

    const ids = result.items.map((i) => i.id).sort()
    expect(ids).toContain('test-owner-id')
    expect(ids).toContain('user-a1')
    expect(ids).not.toContain('user-b1')
  })

  it('excludes platform admin users even when linked to the bailleur', async () => {
    const db = getTestDb()
    await db.update(user).set({ ownerId: 1 }).where(eq(user.id, 'test-admin-id'))

    const result = await ownerCaller.bailleur.users.list({})

    const ids = result.items.map((i) => i.id)
    expect(ids).not.toContain('test-admin-id')
  })

  it('excludes students (role=user) even when linked to the bailleur', async () => {
    const db = getTestDb()
    await createUser({ id: 'stud-1', name: 'Stud', email: 'stud@t.com', role: 'user' })
    await db.update(user).set({ ownerId: 1 }).where(eq(user.id, 'stud-1'))

    const result = await ownerCaller.bailleur.users.list({})
    const ids = result.items.map((i) => i.id)
    expect(ids).not.toContain('stud-1')
  })

  it('filters by search term on firstname/lastname/email', async () => {
    const db = getTestDb()
    await createUser({ id: 'user-a1', name: 'Alice Durand', email: 'alice@a.com', firstname: 'Alice', lastname: 'Durand', role: 'owner' })
    await createUser({ id: 'user-a2', name: 'Bob Martin', email: 'bob@a.com', firstname: 'Bob', lastname: 'Martin', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'user-a1'))
    await db.update(user).set({ ownerId: 1, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'user-a2'))

    const result = await ownerCaller.bailleur.users.list({ search: 'Alice' })
    const ids = result.items.map((i) => i.id)
    expect(ids).toContain('user-a1')
    expect(ids).not.toContain('user-a2')
  })
})

describe('bailleur.users.create', () => {
  it('creates an owner-role user linked to the current bailleur', async () => {
    const db = getTestDb()
    const created = await ownerCaller.bailleur.users.create({
      email: 'new@bailleur-a.com',
      firstname: 'New',
      lastname: 'Manager',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences', 'manage_availability'],
    })

    expect(created?.role).toBe('owner')
    expect(created?.ownerId).toBe(1)
    expect(created?.bailleurRole).toBe('gestionnaire')
    expect(created?.bailleurPermissions).toEqual(['manage_residences', 'manage_availability'])

    const stored = await db.query.user.findFirst({ where: eq(user.email, 'new@bailleur-a.com') })
    expect(stored?.bailleurRole).toBe('gestionnaire')
  })

  it('force permissions to [] when role is administrator', async () => {
    const created = await ownerCaller.bailleur.users.create({
      email: 'admin@bailleur-a.com',
      firstname: 'Admin',
      lastname: 'Co',
      bailleurRole: 'administrator',
      bailleurPermissions: ['manage_residences'],
    })

    expect(created?.bailleurRole).toBe('administrator')
    expect(created?.bailleurPermissions).toEqual([])
  })

  it('rejects duplicate email', async () => {
    await expect(
      ownerCaller.bailleur.users.create({
        email: 'owner@test.com',
        firstname: 'Dup',
        lastname: 'Licate',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: [],
      }),
    ).rejects.toThrow(/existe deja/)
  })

  it('rejects gestionnaire without manage_users permission', async () => {
    const gestCaller = gestionnaireCallerFactory({ permissions: ['manage_residences'] })
    await expect(
      gestCaller.bailleur.users.create({
        email: 'blocked@test.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: [],
      }),
    ).rejects.toThrow(/Permission denied|FORBIDDEN/)
  })

  it('rejects gestionnaire (even with manage_users) from creating another administrator', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-can-mgr-users', name: 'G', email: 'gmu@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-can-mgr-users'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-can-mgr-users', email: 'gmu@a.com', permissions: ['manage_users'] })

    await expect(
      gestCaller.bailleur.users.create({
        email: 'promoted@test.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'administrator',
        bailleurPermissions: [],
      }),
    ).rejects.toThrow(/administrateur/)
  })

  it('rejects gestionnaire from granting manage_users or manage_applications', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-can-mgr-users-2', name: 'G', email: 'gmu2@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-can-mgr-users-2'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-can-mgr-users-2', email: 'gmu2@a.com', permissions: ['manage_users'] })

    await expect(
      gestCaller.bailleur.users.create({
        email: 'sensitive@test.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: ['manage_users', 'manage_residences'],
      }),
    ).rejects.toThrow(/manage_users/)

    await expect(
      gestCaller.bailleur.users.create({
        email: 'sensitive2@test.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: ['manage_applications'],
      }),
    ).rejects.toThrow(/manage_applications/)
  })

  it('allows gestionnaire to grant non-sensitive permissions', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-mgr-3', name: 'G', email: 'gmu3@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-mgr-3'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-mgr-3', email: 'gmu3@a.com', permissions: ['manage_users'] })

    const created = await gestCaller.bailleur.users.create({
      email: 'ok@test.com',
      firstname: 'X',
      lastname: 'Y',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences', 'manage_availability'],
    })
    expect(created?.bailleurPermissions).toEqual(['manage_residences', 'manage_availability'])
  })
})

describe('bailleur.users.update', () => {
  beforeEach(async () => {
    const db = getTestDb()
    await createUser({ id: 'target-user', name: 'Target', email: 'target@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'target-user'))
  })

  it('updates permissions of a gestionnaire', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'target-user',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_availability', 'manage_applications'],
    })

    expect(updated?.bailleurPermissions).toEqual(['manage_availability', 'manage_applications'])
  })

  it('resets permissions to [] when upgrading to administrator', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'target-user',
      bailleurRole: 'administrator',
      bailleurPermissions: ['manage_residences'],
    })

    expect(updated?.bailleurRole).toBe('administrator')
    expect(updated?.bailleurPermissions).toEqual([])
  })

  it('prevents user from demoting themselves from administrator', async () => {
    await expect(
      ownerCaller.bailleur.users.update({
        id: 'test-owner-id', // self
        bailleurRole: 'gestionnaire',
      }),
    ).rejects.toThrow(/ne pouvez pas retirer votre propre/)
  })

  it('rejects gestionnaire from promoting another user to administrator via update', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-up-1', name: 'G', email: 'gu1@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-up-1'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-up-1', email: 'gu1@a.com', permissions: ['manage_users'] })

    await expect(
      gestCaller.bailleur.users.update({
        id: 'target-user',
        bailleurRole: 'administrator',
      }),
    ).rejects.toThrow(/administrateur/)
  })

  it('rejects gestionnaire from granting sensitive permissions via update', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-up-2', name: 'G', email: 'gu2@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-up-2'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-up-2', email: 'gu2@a.com', permissions: ['manage_users'] })

    await expect(
      gestCaller.bailleur.users.update({
        id: 'target-user',
        bailleurPermissions: ['manage_users'],
      }),
    ).rejects.toThrow(/manage_users/)
  })

  it('rejects update of a user from a different bailleur', async () => {
    const db = getTestDb()
    await createUser({ id: 'other-bailleur-user', name: 'Other', email: 'other@b.com', role: 'owner' })
    await db.update(user).set({ ownerId: 2, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'other-bailleur-user'))

    await expect(
      ownerCaller.bailleur.users.update({
        id: 'other-bailleur-user',
        bailleurPermissions: ['manage_users'],
      }),
    ).rejects.toThrow(/non trouve|NOT_FOUND/)
  })
})

describe('bailleur.users.delete', () => {
  beforeEach(async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-to-delete', name: 'Gest', email: 'gest@a.com', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'gest-to-delete'))
  })

  it('deletes a gestionnaire belonging to the current bailleur', async () => {
    const result = await ownerCaller.bailleur.users.delete({ id: 'gest-to-delete' })
    expect(result).toEqual({ id: 'gest-to-delete' })

    const db = getTestDb()
    const still = await db.query.user.findFirst({ where: eq(user.id, 'gest-to-delete') })
    expect(still).toBeUndefined()
  })

  it('prevents self-deletion', async () => {
    await expect(ownerCaller.bailleur.users.delete({ id: 'test-owner-id' })).rejects.toThrow(/vous-meme/)
  })

  it('prevents deletion of the last administrator', async () => {
    // test-owner-id is the only administrator of bailleur A
    // Try to delete via a gestionnaire caller with manage_users permission
    const db = getTestDb()
    await createUser({ id: 'gest-with-users-perm', name: 'G', email: 'gwu@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })
      .where(eq(user.id, 'gest-with-users-perm'))

    const gestCaller = gestionnaireCallerFactory({ id: 'gest-with-users-perm', email: 'gwu@a.com', permissions: ['manage_users'] })

    await expect(gestCaller.bailleur.users.delete({ id: 'test-owner-id' })).rejects.toThrow(/dernier administrateur/)
  })

  it('rejects gestionnaire without manage_users permission', async () => {
    const gestCaller = gestionnaireCallerFactory({ permissions: ['manage_residences'] })
    await expect(gestCaller.bailleur.users.delete({ id: 'gest-to-delete' })).rejects.toThrow(/Permission denied|FORBIDDEN/)
  })
})

describe('bailleurProcedure permission gating on residences/candidatures', () => {
  it('gestionnaire without manage_residences cannot create residence', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-no-res', name: 'G', email: 'gnr@a.com', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: [] }).where(eq(user.id, 'gest-no-res'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-no-res', email: 'gnr@a.com', permissions: [] })

    await expect(
      gestCaller.bailleur.create({
        name: 'Forbidden Res',
        addresses: [{ address: '1 rue X', city: 'Paris', postal_code: '75001' }],
        external_url: 'https://example.com',
        typologies: [
          {
            type: 'T1',
            price_min: 400,
            price_max: 600,
            superficie_min: 15,
            superficie_max: 25,
            colocation: false,
            nb_total: 1,
            nb_available: 1,
          },
        ],
      }),
    ).rejects.toThrow(/Permission denied: manage_residences/)
  })

  it('gestionnaire with manage_residences can create residence', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-with-res', name: 'G', email: 'gwr@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'gest-with-res'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-with-res', email: 'gwr@a.com', permissions: ['manage_residences'] })

    const result = await gestCaller.bailleur.create({
      name: 'Allowed Res',
      addresses: [{ address: '2 rue Y', city: 'Paris', postal_code: '75001' }],
      external_url: 'https://example.com',
      typologies: [
        {
          type: 'T1',
          price_min: 400,
          price_max: 600,
          superficie_min: 15,
          superficie_max: 25,
          colocation: false,
          nb_total: 1,
          nb_available: 1,
        },
      ],
    })

    expect(result.slug).toContain('allowed-res')
  })

  it('gestionnaire without manage_applications cannot list candidatures', async () => {
    const gestCaller = gestionnaireCallerFactory({ permissions: ['manage_residences'] })
    await expect(gestCaller.bailleur.listCandidatures({ page: 1 })).rejects.toThrow(/Permission denied: manage_applications/)
  })

  it('platform admin has implicit access to every permission-gated endpoint', async () => {
    await expect(adminCaller.bailleur.listCandidatures({ page: 1 })).resolves.toBeDefined()
  })

  it('administrator has implicit access to every permission-gated endpoint', async () => {
    await expect(ownerCaller.bailleur.listCandidatures({ page: 1 })).resolves.toBeDefined()
  })
})
