import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/server/db'
import { contactRequests } from '~/server/db/schema'
import { verifyClaimToken } from './claim-token'

export type TClaimedContactRequest = {
  firstname: string | null
  lastname: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  scholarshipStatus: string | null
}

/**
 * Coordonnées de la demande de contact désignée par le jeton, pour préremplir l'inscription.
 * Volontairement réservé au serveur (aucune procédure tRPC publique) : le jeton n'a ainsi jamais
 * besoin d'être échangeable contre des données personnelles depuis le navigateur.
 */
export const getClaimedContactRequest = async (token: string | undefined): Promise<TClaimedContactRequest | null> => {
  if (!token) return null

  const id = verifyClaimToken(token)
  if (!id) return null

  const request = await db.query.contactRequests.findFirst({
    // Une demande déjà rattachée à un compte n'a plus à alimenter un formulaire d'inscription.
    where: and(eq(contactRequests.id, id), isNull(contactRequests.userId)),
    columns: { firstname: true, lastname: true, email: true, phone: true, birthdate: true, scholarshipStatus: true },
  })

  return request ?? null
}
