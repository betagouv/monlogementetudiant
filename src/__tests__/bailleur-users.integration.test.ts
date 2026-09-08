import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { user } from '../server/db/schema/auth'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, gestionnaireCallerFactory, ownerCaller, ownerCaller2 } from './helpers/test-caller'

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

  // Parcours choisi : sans lui, `manage_applications` n'est pas accordable (protection des donnees).
  const owner = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'test-owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
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

  it('rejects any gestionnaire: managing accounts follows the role, not a permission', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-no-perm', name: 'G', email: 'g@test.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences', 'manage_applications'] })
      .where(eq(user.id, 'gest-no-perm'))
    const gestCaller = gestionnaireCallerFactory({
      id: 'gest-no-perm',
      email: 'g@test.com',
      permissions: ['manage_residences', 'manage_applications'],
    })

    await expect(gestCaller.bailleur.users.list({})).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
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
      bailleurPermissions: ['manage_residences', 'manage_applications'],
    })

    expect(created?.role).toBe('owner')
    expect(created?.ownerId).toBe(1)
    expect(created?.bailleurRole).toBe('gestionnaire')
    expect(created?.bailleurPermissions).toEqual(['manage_residences', 'manage_applications'])

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

  it('rejects any gestionnaire from creating an account', async () => {
    const gestCaller = gestionnaireCallerFactory({ permissions: ['manage_residences', 'manage_applications'] })
    await expect(
      gestCaller.bailleur.users.create({
        email: 'blocked@test.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: [],
      }),
    ).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
  })

  it('refuses manage_applications when the bailleur has no application journey', async () => {
    // Bailleur B n'a pas choisi de parcours : l'autorisation n'ouvre aucun ecran, on la refuse.
    await expect(
      ownerCaller2.bailleur.users.create({
        email: 'sans-parcours@bailleur-b.com',
        firstname: 'X',
        lastname: 'Y',
        bailleurRole: 'gestionnaire',
        bailleurPermissions: ['manage_applications'],
      }),
    ).rejects.toThrow(/parcours de candidature/)
  })

  it('allows manage_residences when the bailleur has no application journey', async () => {
    const created = await ownerCaller2.bailleur.users.create({
      email: 'residences-only@bailleur-b.com',
      firstname: 'X',
      lastname: 'Y',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences'],
    })
    expect(created?.bailleurPermissions).toEqual(['manage_residences'])
  })

  it('allows creating a second administrator', async () => {
    // test-owner-id est le seul administrateur du bailleur A : il reste une place.
    const created = await ownerCaller.bailleur.users.create({
      email: 'admin2@test.com',
      firstname: 'Second',
      lastname: 'Administrateur',
      bailleurRole: 'administrator',
      bailleurPermissions: [],
    })

    expect(created?.bailleurRole).toBe('administrator')
  })

  it('rejects creating a third administrator', async () => {
    const db = getTestDb()
    await createUser({ id: 'admin-2-create', name: 'Admin 2', email: 'a2c@a.com', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'administrator' }).where(eq(user.id, 'admin-2-create'))

    await expect(
      ownerCaller.bailleur.users.create({
        email: 'admin3@test.com',
        firstname: 'Troisieme',
        lastname: 'Administrateur',
        bailleurRole: 'administrator',
        bailleurPermissions: [],
      }),
    ).rejects.toThrow(/ne peut compter plus de 2 administrateurs/)
  })

  it('does not count platform admins linked to the bailleur towards the limit', async () => {
    const db = getTestDb()
    // Un admin plateforme rattache au bailleur n'occupe pas une place d'administrateur bailleur.
    await createUser({ id: 'platform-admin-linked', name: 'PA', email: 'pa@a.com', role: 'admin' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'administrator' }).where(eq(user.id, 'platform-admin-linked'))

    const created = await ownerCaller.bailleur.users.create({
      email: 'admin-ok@test.com',
      firstname: 'Second',
      lastname: 'Administrateur',
      bailleurRole: 'administrator',
      bailleurPermissions: [],
    })

    expect(created?.bailleurRole).toBe('administrator')
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
      bailleurPermissions: ['manage_residences', 'manage_applications'],
    })

    expect(updated?.bailleurPermissions).toEqual(['manage_residences', 'manage_applications'])
  })

  it('updates the email of a gestionnaire', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'target-user',
      email: 'nouvelle-adresse@a.com',
    })

    expect(updated?.email).toBe('nouvelle-adresse@a.com')
  })

  it('updates firstname, lastname and email together', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'target-user',
      firstname: 'Camille',
      lastname: 'Duboisset',
      email: 'camille.duboisset@a.com',
    })

    expect(updated?.email).toBe('camille.duboisset@a.com')
    expect(updated?.firstname).toBe('Camille')
    expect(updated?.lastname).toBe('Duboisset')
    expect(updated?.name).toBe('Camille Duboisset')
  })

  it('rejects an email already used by another user', async () => {
    await expect(
      ownerCaller.bailleur.users.update({
        id: 'target-user',
        email: 'owner@test.com',
      }),
    ).rejects.toThrow(/existe deja avec cet email/)
  })

  it('accepts the unchanged email of the edited user', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'target-user',
      email: 'target@a.com',
      firstname: 'Target',
    })

    expect(updated?.email).toBe('target@a.com')
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

  it('rejects any gestionnaire from updating an account', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-up-1', name: 'G', email: 'gu1@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences', 'manage_applications'] })
      .where(eq(user.id, 'gest-up-1'))
    const gestCaller = gestionnaireCallerFactory({
      id: 'gest-up-1',
      email: 'gu1@a.com',
      permissions: ['manage_residences', 'manage_applications'],
    })

    await expect(
      gestCaller.bailleur.users.update({
        id: 'target-user',
        bailleurRole: 'administrator',
      }),
    ).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
  })

  it('refuses granting manage_applications without an application journey', async () => {
    const db = getTestDb()
    await createUser({ id: 'target-b', name: 'Target B', email: 'target@b.com', role: 'owner' })
    await db.update(user).set({ ownerId: 2, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'target-b'))

    await expect(
      ownerCaller2.bailleur.users.update({
        id: 'target-b',
        bailleurPermissions: ['manage_applications'],
      }),
    ).rejects.toThrow(/parcours de candidature/)
  })

  it('rejects promoting a gestionnaire when the bailleur already has 2 administrators', async () => {
    const db = getTestDb()
    // test-owner-id est deja administrateur : on en ajoute un second pour saturer le quota.
    await createUser({ id: 'admin-2', name: 'Admin 2', email: 'admin2@a.com', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'administrator' }).where(eq(user.id, 'admin-2'))

    await expect(ownerCaller.bailleur.users.update({ id: 'target-user', bailleurRole: 'administrator' })).rejects.toThrow(
      /ne peut compter plus de 2 administrateurs/,
    )
  })

  it('allows editing an existing administrator when the limit is reached', async () => {
    const db = getTestDb()
    await createUser({ id: 'admin-2', name: 'Admin 2', email: 'admin2@a.com', role: 'owner' })
    await db.update(user).set({ ownerId: 1, bailleurRole: 'administrator' }).where(eq(user.id, 'admin-2'))

    // Le quota est plein, mais admin-2 occupe deja une des deux places : editer son nom doit passer.
    const updated = await ownerCaller.bailleur.users.update({
      id: 'admin-2',
      firstname: 'Renomme',
      lastname: 'Administrateur',
      bailleurRole: 'administrator',
    })

    expect(updated?.firstname).toBe('Renomme')
    expect(updated?.bailleurRole).toBe('administrator')
  })

  it('does not count administrators of another bailleur towards the limit', async () => {
    const db = getTestDb()
    // Deux administrateurs sur le bailleur B ne doivent pas bloquer une promotion sur le bailleur A.
    await createUser({ id: 'b-admin-1', name: 'B1', email: 'b1@b.com', role: 'owner' })
    await createUser({ id: 'b-admin-2', name: 'B2', email: 'b2@b.com', role: 'owner' })
    await db.update(user).set({ ownerId: 2, bailleurRole: 'administrator' }).where(eq(user.id, 'b-admin-1'))
    await db.update(user).set({ ownerId: 2, bailleurRole: 'administrator' }).where(eq(user.id, 'b-admin-2'))

    const updated = await ownerCaller.bailleur.users.update({ id: 'target-user', bailleurRole: 'administrator' })
    expect(updated?.bailleurRole).toBe('administrator')
  })

  it('rejects demoting the last administrator of the bailleur', async () => {
    const db = getTestDb()
    // test-owner-id est le seul administrateur ; un admin plateforme rattache au bailleur tente de le
    // retrograder (il ne peut pas etre sa propre cible, ce qui isole bien la regle du dernier admin).
    await db.update(user).set({ ownerId: 1 }).where(eq(user.id, 'test-admin-id'))

    await expect(adminCaller.bailleur.users.update({ id: 'test-owner-id', bailleurRole: 'gestionnaire' })).rejects.toThrow(
      /dernier administrateur/,
    )
  })

  it('rejects a gestionnaire editing their own account', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-self', name: 'G', email: 'gs@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'gest-self'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-self', email: 'gs@a.com', permissions: ['manage_residences'] })

    // Le refus tombe desormais au niveau du role : `canEditOwnAccount` reste une garde defensive.
    await expect(gestCaller.bailleur.users.update({ id: 'gest-self', firstname: 'Autoproclame' })).rejects.toThrow(
      /Administrateur du bailleur requis|FORBIDDEN/,
    )
  })

  it('allows an administrator to edit their own name and email', async () => {
    const updated = await ownerCaller.bailleur.users.update({
      id: 'test-owner-id',
      firstname: 'Admin',
      lastname: 'Bailleur',
      email: 'admin.bailleur@a.com',
    })

    expect(updated?.email).toBe('admin.bailleur@a.com')
    expect(updated?.name).toBe('Admin Bailleur')
  })

  it('rejects a gestionnaire reading a record via getById, even their own', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-read-self', name: 'G', email: 'grs@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId: 1, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'gest-read-self'))
    const gestCaller = gestionnaireCallerFactory({ id: 'gest-read-self', email: 'grs@a.com', permissions: ['manage_residences'] })

    await expect(gestCaller.bailleur.users.getById({ id: 'gest-read-self' })).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
  })

  it('rejects update of a user from a different bailleur', async () => {
    const db = getTestDb()
    await createUser({ id: 'other-bailleur-user', name: 'Other', email: 'other@b.com', role: 'owner' })
    await db.update(user).set({ ownerId: 2, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'other-bailleur-user'))

    await expect(
      ownerCaller.bailleur.users.update({
        id: 'other-bailleur-user',
        bailleurPermissions: ['manage_residences'],
      }),
    ).rejects.toThrow(/non trouve|NOT_FOUND/)
  })
})

describe("scenario administratrice bailleur : cycle de vie d'un membre d'equipe", () => {
  it('cree, renomme, change l email puis supprime un membre de son equipe', async () => {
    const db = getTestDb()

    // 1. Creation
    const created = await ownerCaller.bailleur.users.create({
      email: 'membre@afev.org',
      firstname: 'Prenom',
      lastname: 'Nom',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences'],
    })
    expect(created?.ownerId).toBe(1)
    expect(created?.role).toBe('owner')

    // 2. Modification du nom, du prenom et de l'email en une passe
    const updated = await ownerCaller.bailleur.users.update({
      id: created.id,
      firstname: 'Nouveau',
      lastname: 'NomDeFamille',
      email: 'nouveau.membre@afev.org',
    })
    expect(updated?.firstname).toBe('Nouveau')
    expect(updated?.lastname).toBe('NomDeFamille')
    expect(updated?.email).toBe('nouveau.membre@afev.org')
    expect(updated?.name).toBe('Nouveau NomDeFamille')

    // 3. Les modifications sont bien persistees et visibles dans la liste
    const list = await ownerCaller.bailleur.users.list({})
    expect(list.items.find((u) => u.id === created.id)?.email).toBe('nouveau.membre@afev.org')

    // 4. Suppression
    await ownerCaller.bailleur.users.delete({ id: created.id })
    const gone = await db.query.user.findFirst({ where: eq(user.id, created.id) })
    expect(gone).toBeUndefined()
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
    // test-owner-id est le seul administrateur du bailleur A ; la suppression est tentee par un
    // admin plateforme rattache au bailleur, pour ne pas buter d'abord sur l'auto-suppression.
    const db = getTestDb()
    await db.update(user).set({ ownerId: 1 }).where(eq(user.id, 'test-admin-id'))

    await expect(adminCaller.bailleur.users.delete({ id: 'test-owner-id' })).rejects.toThrow(/dernier administrateur/)
  })

  it('rejects any gestionnaire from deleting an account', async () => {
    const gestCaller = gestionnaireCallerFactory({ permissions: ['manage_residences', 'manage_applications'] })
    await expect(gestCaller.bailleur.users.delete({ id: 'gest-to-delete' })).rejects.toThrow(/Administrateur du bailleur requis|FORBIDDEN/)
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
        addresses: [{ address: '1 rue X', city: 'Paris', postalCode: '75001' }],
        externalUrl: 'https://example.com',
        typologies: [
          {
            type: 't1',
            priceMin: 400,
            priceMax: 600,
            superficieMin: 15,
            superficieMax: 25,
            colocation: false,
            nbTotal: 1,
            nbAvailable: 1,
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
      addresses: [{ address: '2 rue Y', city: 'Paris', postalCode: '75001' }],
      externalUrl: 'https://example.com',
      typologies: [
        {
          type: 't1',
          priceMin: 400,
          priceMax: 600,
          superficieMin: 15,
          superficieMax: 25,
          colocation: false,
          nbTotal: 1,
          nbAvailable: 1,
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
