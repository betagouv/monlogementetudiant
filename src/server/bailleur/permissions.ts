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

// Administrateur au sens large : administrateur du bailleur, ou admin plateforme qui agit en son nom.
export function isBailleurAdministrator(u: PermissionCheckUser): boolean {
  return u.role === 'admin' || u.bailleurRole === 'administrator'
}

export function canGrantAdministratorRights(u: PermissionCheckUser): boolean {
  return isBailleurAdministrator(u)
}

// Modifier son propre compte (nom, email, rôle, permissions) reste réservé aux administrateurs :
// un gestionnaire porteur de `manage_users` pourrait sinon détourner son compte en changeant son email.
export function canEditOwnAccount(u: PermissionCheckUser): boolean {
  return isBailleurAdministrator(u)
}

// Un bailleur ne peut pas compter plus de 2 administrateurs. Le plafond est tenu côté serveur dans les
// deux routeurs (espace bailleur et administration plateforme) ; l'espace bailleur le contrôle en plus
// à la soumission du formulaire, pour ouvrir une modale plutôt que d'échouer après un aller-retour.
export const MAX_BAILLEUR_ADMINISTRATORS = 2

// Permissions posées par défaut sur un compte rétrogradé d'administrateur à gestionnaire :
// dossiers étudiants, disponibilités et résidences — volontairement sans `manage_users`.
export const DEFAULT_GESTIONNAIRE_PERMISSIONS: BailleurPermission[] = ['manage_applications', 'manage_availability', 'manage_residences']
