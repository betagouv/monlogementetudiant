import { TRPCError } from '@trpc/server'
import { and, count, eq, ne } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { MAX_BAILLEUR_ADMINISTRATORS } from './permissions'

export const ADMINISTRATOR_LIMIT_MESSAGE = `Un bailleur ne peut compter plus de ${MAX_BAILLEUR_ADMINISTRATORS} administrateurs. Retrogradez un administrateur en gestionnaire avant d'en designer un nouveau.`

export const LAST_ADMINISTRATOR_MESSAGE = 'Impossible de retirer le role administrateur au dernier administrateur du bailleur'

/**
 * Nombre d'administrateurs d'un bailleur. `excludeUserId` sort la cible du compte : sans lui, editer
 * un administrateur existant declencherait le plafond alors qu'il occupe deja une des places.
 */
export async function countBailleurAdministrators(ownerId: number, excludeUserId?: string): Promise<number> {
  const conditions = [eq(user.ownerId, ownerId), eq(user.role, 'owner'), eq(user.bailleurRole, 'administrator')]
  if (excludeUserId) conditions.push(ne(user.id, excludeUserId))

  const [row] = await db
    .select({ administratorCount: count() })
    .from(user)
    .where(and(...conditions))

  return row?.administratorCount ?? 0
}

/** Leve si le bailleur a deja atteint le plafond d'administrateurs. */
export async function assertAdministratorSlotAvailable(ownerId: number, excludeUserId?: string): Promise<void> {
  const administratorCount = await countBailleurAdministrators(ownerId, excludeUserId)
  if (administratorCount >= MAX_BAILLEUR_ADMINISTRATORS) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: ADMINISTRATOR_LIMIT_MESSAGE })
  }
}

/**
 * Leve si retirer le role administrateur a `targetUserId` laisserait le bailleur sans aucun administrateur.
 * Le message est passe par l'appelant : `delete` et `update` ne racontent pas la meme action.
 */
export async function assertNotLastAdministrator(ownerId: number, targetUserId: string, message: string): Promise<void> {
  const administratorCount = await countBailleurAdministrators(ownerId, targetUserId)
  if (administratorCount === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message })
  }
}
