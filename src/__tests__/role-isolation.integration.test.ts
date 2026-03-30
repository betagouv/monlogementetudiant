import { beforeEach, describe, expect, it } from 'vitest'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, ownerCaller } from './helpers/test-caller'

beforeEach(async () => {
  await createUser({ id: 'test-user-id', name: 'Test User', email: 'user@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

// ─── Student (role=user) cannot access bailleur routes ──────────────────────

describe('student cannot access bailleur routes', () => {
  it('rejects student from bailleur.list', async () => {
    await expect(authenticatedCaller.bailleur.list({ page: 1 })).rejects.toThrow('Owner or admin role required')
  })

  it('rejects student from bailleur.create', async () => {
    await expect(
      authenticatedCaller.bailleur.create({
        name: 'Résidence Test',
        address: '1 rue de la Paix',
        city: 'Paris',
        postal_code: '75001',
        external_url: 'https://example.com',
        typologies: [
          {
            type: 'T1',
            price_min: 400,
            price_max: 600,
            superficie_min: 15,
            superficie_max: 25,
            colocation: false,
            nb_total: 10,
            nb_available: 5,
          },
        ],
      }),
    ).rejects.toThrow('Owner or admin role required')
  })

  it('rejects student from bailleur.update', async () => {
    await expect(authenticatedCaller.bailleur.update({ slug: 'any-slug', name: 'New Name' })).rejects.toThrow(
      'Owner or admin role required',
    )
  })

  it('rejects student from bailleur.updateAvailability', async () => {
    await expect(
      authenticatedCaller.bailleur.updateAvailability({
        slug: 'any-slug',
        nb_t1_available: 1,
        nb_t1_bis_available: null,
        nb_t2_available: null,
        nb_t3_available: null,
        nb_t4_available: null,
        nb_t5_available: null,
        nb_t6_available: null,
        nb_t7_more_available: null,
      }),
    ).rejects.toThrow('Owner or admin role required')
  })

  it('rejects unauthenticated from bailleur.list', async () => {
    await expect(caller.bailleur.list({ page: 1 })).rejects.toThrow('UNAUTHORIZED')
  })
})

// ─── Student (role=user) cannot access admin routes ─────────────────────────

describe('student cannot access admin routes', () => {
  it('rejects student from admin.users.list', async () => {
    await expect(authenticatedCaller.admin.users.list({ page: 1 })).rejects.toThrow('Admin role required')
  })

  it('rejects student from admin.owners.list', async () => {
    await expect(authenticatedCaller.admin.owners.list({ page: 1 })).rejects.toThrow('Admin role required')
  })

  it('rejects student from admin.stats.overview', async () => {
    await expect(authenticatedCaller.admin.stats.overview()).rejects.toThrow('Admin role required')
  })
})

// ─── Owner (role=owner) cannot access student routes ────────────────────────

describe('owner cannot access favorites routes', () => {
  it('rejects owner from favorites.list', async () => {
    await expect(ownerCaller.favorites.list()).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from favorites.add', async () => {
    await expect(ownerCaller.favorites.add({ accommodationSlug: 'any' })).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from favorites.remove', async () => {
    await expect(ownerCaller.favorites.remove({ slug: 'any' })).rejects.toThrow('Student or admin role required')
  })
})

describe('owner cannot access alerts routes', () => {
  it('rejects owner from alerts.list', async () => {
    await expect(ownerCaller.alerts.list()).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from alerts.create', async () => {
    await expect(ownerCaller.alerts.create({ name: 'Test', has_coliving: false, is_accessible: false, max_price: 500 })).rejects.toThrow(
      'Student or admin role required',
    )
  })

  it('rejects owner from alerts.update', async () => {
    await expect(ownerCaller.alerts.update({ id: 1, name: 'Updated' })).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from alerts.delete', async () => {
    await expect(ownerCaller.alerts.delete({ id: 1 })).rejects.toThrow('Student or admin role required')
  })
})

describe('owner cannot access dossierFacile routes', () => {
  it('rejects owner from dossierFacile.tenant', async () => {
    await expect(ownerCaller.dossierFacile.tenant()).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from dossierFacile.listApplications', async () => {
    await expect(ownerCaller.dossierFacile.listApplications({ accommodationSlug: 'any' })).rejects.toThrow('Student or admin role required')
  })

  it('rejects owner from dossierFacile.application', async () => {
    await expect(ownerCaller.dossierFacile.application({ accommodationSlug: 'x', apartmentType: 't1' })).rejects.toThrow(
      'Student or admin role required',
    )
  })
})

// ─── Owner (role=owner) cannot access admin routes ──────────────────────────

describe('owner cannot access admin routes', () => {
  it('rejects owner from admin.users.list', async () => {
    await expect(ownerCaller.admin.users.list({ page: 1 })).rejects.toThrow('Admin role required')
  })

  it('rejects owner from admin.owners.list', async () => {
    await expect(ownerCaller.admin.owners.list({ page: 1 })).rejects.toThrow('Admin role required')
  })
})

// ─── Admin can access both student and owner routes ─────────────────────────

describe('admin can access bailleur routes', () => {
  it('admin can call bailleur.list', async () => {
    const result = await adminCaller.bailleur.list({ page: 1 })
    expect(result.count).toBe(0)
  })
})

describe('admin can access student routes', () => {
  it('admin can call favorites.list', async () => {
    const result = await adminCaller.favorites.list()
    expect(result).toEqual([])
  })

  it('admin can call alerts.list', async () => {
    const result = await adminCaller.alerts.list()
    expect(result).toEqual([])
  })

  it('admin can call dossierFacile.tenant', async () => {
    const result = await adminCaller.dossierFacile.tenant()
    expect(result).toBeNull()
  })
})
