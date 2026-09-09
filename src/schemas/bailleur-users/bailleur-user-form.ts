import { z } from 'zod'
import {
  BAILLEUR_PERMISSIONS,
  BAILLEUR_ROLES,
  type BailleurPermission,
  type BailleurRole,
  hasUsableGestionnairePermissions,
} from '~/server/bailleur/permissions'

export const zCreateBailleurUser = z.object({
  email: z.string().email('Email invalide'),
  firstname: z.string().min(1, 'Le prenom est requis'),
  lastname: z.string().min(1, 'Le nom est requis'),
  bailleurRole: z.enum(BAILLEUR_ROLES),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).default([]),
})

export const zUpdateBailleurUser = z.object({
  id: z.string(),
  email: z.string().email('Email invalide').optional(),
  firstname: z.string().min(1, 'Le prenom est requis').optional(),
  lastname: z.string().min(1, 'Le nom est requis').optional(),
  bailleurRole: z.enum(BAILLEUR_ROLES).optional(),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).optional(),
})

/**
 * Un gestionnaire sans autorisation n'ouvre aucun ecran : chaque section le renvoie au tableau de
 * bord. La regle s'applique a la creation et aux mises a jour qui touchent explicitement aux
 * autorisations ; une mise a jour partielle (nom, email) reste possible sans les renvoyer.
 * A composer apres `.extend()`, les schemas restant des objets extensibles.
 */
export function gestionnairePermissionsAreUsable(values: {
  bailleurRole?: BailleurRole | null
  bailleurPermissions?: BailleurPermission[]
}): boolean {
  if (values.bailleurRole !== 'gestionnaire') return true
  if (values.bailleurPermissions === undefined) return true
  return hasUsableGestionnairePermissions(values.bailleurPermissions)
}

export const GESTIONNAIRE_PERMISSIONS_REQUIRED: { path: PropertyKey[]; message: string } = {
  path: ['bailleurPermissions'],
  message: 'Selectionnez au moins une autorisation pour un gestionnaire',
}

export type CreateBailleurUserInput = z.infer<typeof zCreateBailleurUser>
export type UpdateBailleurUserInput = z.infer<typeof zUpdateBailleurUser>
