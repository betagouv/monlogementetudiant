import { EOwnerContactMode } from '~/enums/owner-contact-mode'
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

// Administrateur au sens large : administrateur du bailleur, ou admin plateforme qui agit en son nom.
export function isBailleurAdministrator(u: PermissionCheckUser): boolean {
  return u.role === 'admin' || u.bailleurRole === 'administrator'
}

export function canGrantAdministratorRights(u: PermissionCheckUser): boolean {
  return isBailleurAdministrator(u)
}

// Modifier son propre compte (nom, email, rôle, permissions) reste réservé aux administrateurs.
// Garde défensive : l'écran des utilisateurs n'est déjà atteignable que par un administrateur.
export function canEditOwnAccount(u: PermissionCheckUser): boolean {
  return isBailleurAdministrator(u)
}

export const MAX_BAILLEUR_ADMINISTRATORS = 2

export function canGrantApplicationsPermission(contactMode: EOwnerContactMode): boolean {
  return contactMode !== EOwnerContactMode.NONE
}

export function grantablePermissions(contactMode: EOwnerContactMode): BailleurPermission[] {
  return BAILLEUR_PERMISSIONS.filter((p) => p !== 'manage_applications' || canGrantApplicationsPermission(contactMode))
}

export function sanitizeGestionnairePermissions(permissions: BailleurPermission[], contactMode: EOwnerContactMode): BailleurPermission[] {
  const grantable = grantablePermissions(contactMode)
  return permissions.filter((p) => grantable.includes(p))
}

export const DEFAULT_GESTIONNAIRE_PERMISSIONS: BailleurPermission[] = ['manage_applications', 'manage_residences']

// Autorisations pre-cochees a la creation d'un gestionnaire : un compte sans autorisation
// n'ouvre aucun ecran, il est renvoye au tableau de bord depuis chaque section.
export function defaultGestionnairePermissions(contactMode: EOwnerContactMode): BailleurPermission[] {
  return sanitizeGestionnairePermissions(DEFAULT_GESTIONNAIRE_PERMISSIONS, contactMode)
}

// Un gestionnaire doit conserver au moins une autorisation, sinon son compte est inerte.
export function hasUsableGestionnairePermissions(permissions: BailleurPermission[]): boolean {
  return permissions.length > 0
}

/**
 * Bascule `manage_applications` sans toucher au reste des autorisations : c'est ce que fait l'ecran
 * « Parametres de moderation », qui n'edite qu'une autorisation a la fois pour toute une equipe.
 * Le resultat peut etre vide — a l'appelant de le refuser via `hasUsableGestionnairePermissions`.
 */
export function nextApplicationsPermissions(current: BailleurPermission[], enabled: boolean): BailleurPermission[] {
  if (!enabled) return current.filter((p) => p !== 'manage_applications')
  return current.includes('manage_applications') ? [...current] : [...current, 'manage_applications']
}
