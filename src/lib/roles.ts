/**
 * Accès aux espaces par rôle, en **liste blanche** : `user.role` est un texte libre en base, un rôle
 * inattendu ne doit ouvrir ni l'espace bailleur ni l'espace étudiant, ni recevoir de lien de connexion.
 * Partagé par les procédures tRPC, les layouts et Better Auth pour que les gardes ne divergent pas.
 */
const OWNER_SPACE_ROLES: readonly string[] = ['owner', 'admin']
const STUDENT_SPACE_ROLES: readonly string[] = ['user', 'admin']

export const canAccessOwnerSpace = (role: string | null | undefined): boolean => !!role && OWNER_SPACE_ROLES.includes(role)

export const canAccessStudentSpace = (role: string | null | undefined): boolean => !!role && STUDENT_SPACE_ROLES.includes(role)
