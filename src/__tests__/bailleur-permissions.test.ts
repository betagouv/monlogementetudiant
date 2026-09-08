import { describe, expect, it } from 'vitest'
import {
  canEditOwnAccount,
  DEFAULT_GESTIONNAIRE_PERMISSIONS,
  hasPermission,
  hasRole,
  isBailleurAdministrator,
  MAX_BAILLEUR_ADMINISTRATORS,
  type PermissionCheckUser,
} from '~/server/bailleur/permissions'

const admin: PermissionCheckUser = { role: 'admin', bailleurRole: null, bailleurPermissions: [] }
const administrator: PermissionCheckUser = { role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [] }
const gestionnaireWithResidences: PermissionCheckUser = {
  role: 'owner',
  bailleurRole: 'gestionnaire',
  bailleurPermissions: ['manage_residences'],
}
const gestionnaireEmpty: PermissionCheckUser = { role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: [] }
const student: PermissionCheckUser = { role: 'user', bailleurRole: null, bailleurPermissions: [] }

describe('hasRole', () => {
  it('platform admin is every role', () => {
    expect(hasRole(admin, 'administrator')).toBe(true)
    expect(hasRole(admin, 'gestionnaire')).toBe(true)
  })

  it('matches exact bailleur role', () => {
    expect(hasRole(administrator, 'administrator')).toBe(true)
    expect(hasRole(administrator, 'gestionnaire')).toBe(false)
    expect(hasRole(gestionnaireEmpty, 'gestionnaire')).toBe(true)
    expect(hasRole(gestionnaireEmpty, 'administrator')).toBe(false)
  })

  it('student has no bailleur role', () => {
    expect(hasRole(student, 'administrator')).toBe(false)
    expect(hasRole(student, 'gestionnaire')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('platform admin has every permission', () => {
    expect(hasPermission(admin, 'manage_users')).toBe(true)
    expect(hasPermission(admin, 'manage_residences')).toBe(true)
  })

  it('administrator has every permission implicitly', () => {
    expect(hasPermission(administrator, 'manage_users')).toBe(true)
    expect(hasPermission(administrator, 'manage_residences')).toBe(true)
    expect(hasPermission(administrator, 'manage_availability')).toBe(true)
    expect(hasPermission(administrator, 'manage_applications')).toBe(true)
  })

  it('gestionnaire has only listed permissions', () => {
    expect(hasPermission(gestionnaireWithResidences, 'manage_residences')).toBe(true)
    expect(hasPermission(gestionnaireWithResidences, 'manage_users')).toBe(false)
    expect(hasPermission(gestionnaireWithResidences, 'manage_availability')).toBe(false)
  })

  it('gestionnaire with empty permissions has none', () => {
    expect(hasPermission(gestionnaireEmpty, 'manage_residences')).toBe(false)
    expect(hasPermission(gestionnaireEmpty, 'manage_users')).toBe(false)
  })

  it('student has no permissions', () => {
    expect(hasPermission(student, 'manage_residences')).toBe(false)
  })
})

describe('isBailleurAdministrator', () => {
  it('is true for a platform admin', () => {
    expect(isBailleurAdministrator(admin)).toBe(true)
  })

  it('is true for a bailleur administrator', () => {
    expect(isBailleurAdministrator(administrator)).toBe(true)
  })

  it('is false for a gestionnaire even with manage_users', () => {
    const gestionnaireWithUsers: PermissionCheckUser = {
      role: 'owner',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_users'],
    }
    expect(isBailleurAdministrator(gestionnaireWithUsers)).toBe(false)
  })
})

describe('canEditOwnAccount', () => {
  it('allows administrators and platform admins', () => {
    expect(canEditOwnAccount(administrator)).toBe(true)
    expect(canEditOwnAccount(admin)).toBe(true)
  })

  it('refuses a gestionnaire, even carrying manage_users', () => {
    expect(canEditOwnAccount(gestionnaireEmpty)).toBe(false)
    expect(canEditOwnAccount({ role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_users'] })).toBe(false)
  })
})

describe('constantes de retrogradation', () => {
  it('plafonne les administrateurs a 2', () => {
    expect(MAX_BAILLEUR_ADMINISTRATORS).toBe(2)
  })

  it('les permissions par defaut du gestionnaire couvrent dossiers, disponibilites et residences', () => {
    expect([...DEFAULT_GESTIONNAIRE_PERMISSIONS].sort()).toEqual(['manage_applications', 'manage_availability', 'manage_residences'])
  })

  it('les permissions par defaut du gestionnaire excluent manage_users', () => {
    expect(DEFAULT_GESTIONNAIRE_PERMISSIONS).not.toContain('manage_users')
  })
})
