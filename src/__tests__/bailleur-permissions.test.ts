import { describe, expect, it } from 'vitest'
import { hasPermission, hasRole, type PermissionCheckUser } from '~/server/bailleur/permissions'

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
