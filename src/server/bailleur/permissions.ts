import { bailleurPermissionEnum, bailleurRoleEnum } from '~/server/db/schema/auth'

export const BAILLEUR_PERMISSIONS = bailleurPermissionEnum.enumValues
export const BAILLEUR_ROLES = bailleurRoleEnum.enumValues

export type BailleurPermission = (typeof BAILLEUR_PERMISSIONS)[number]
export type BailleurRole = (typeof BAILLEUR_ROLES)[number]

export type PermissionCheckUser = {
  role: string
  bailleurRole: BailleurRole | null
  bailleurPermissions: BailleurPermission[]
}

export function hasRole(u: PermissionCheckUser, role: BailleurRole): boolean {
  if (u.role === 'admin') return true
  return u.bailleurRole === role
}

export function hasPermission(u: PermissionCheckUser, permission: BailleurPermission): boolean {
  if (u.role === 'admin') return true
  if (u.bailleurRole === 'administrator') return true
  return u.bailleurPermissions.includes(permission)
}

// Permissions sensibles : seuls les administrateurs (bailleur ou plateforme) peuvent les accorder.
export const ADMIN_ONLY_PERMISSIONS: BailleurPermission[] = ['manage_users', 'manage_applications']

export function canGrantAdministratorRights(u: PermissionCheckUser): boolean {
  return u.role === 'admin' || u.bailleurRole === 'administrator'
}
