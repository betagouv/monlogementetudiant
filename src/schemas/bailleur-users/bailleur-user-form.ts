import { z } from 'zod'
import { BAILLEUR_PERMISSIONS, BAILLEUR_ROLES } from '~/server/bailleur/permissions'

export const zCreateBailleurUser = z.object({
  email: z.string().email('Email invalide'),
  firstname: z.string().min(1, 'Le prenom est requis'),
  lastname: z.string().min(1, 'Le nom est requis'),
  bailleurRole: z.enum(BAILLEUR_ROLES),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).default([]),
})

export const zUpdateBailleurUser = z.object({
  id: z.string(),
  firstname: z.string().min(1, 'Le prenom est requis').optional(),
  lastname: z.string().min(1, 'Le nom est requis').optional(),
  bailleurRole: z.enum(BAILLEUR_ROLES).optional(),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).optional(),
})

export type CreateBailleurUserInput = z.infer<typeof zCreateBailleurUser>
export type UpdateBailleurUserInput = z.infer<typeof zUpdateBailleurUser>
