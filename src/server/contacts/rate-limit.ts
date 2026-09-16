import { createHmac } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '~/server/db'
import { contactRequests } from '~/server/db/schema'
import { env } from '~/server/env'

/** Nombre maximal de demandes de contact acceptées depuis une même IP sur la fenêtre. */
const MAX_REQUESTS_PER_WINDOW = 5
const WINDOW_MS = 60 * 60 * 1000

/**
 * L'IP n'est jamais stockée en clair : on garde un HMAC (clé = `AUTH_SECRET`), suffisant pour
 * compter les demandes d'une même source sans conserver de donnée directement identifiante.
 */
export const hashIp = (ip: string | null): string | null => {
  if (!ip) return null
  return createHmac('sha256', env.AUTH_SECRET).update(ip).digest('base64url')
}

/** Extrait l'IP cliente des en-têtes posés par le routeur Scalingo (premier maillon de la chaîne). */
export const getClientIp = (req: Request | undefined): string | null => {
  const forwarded = req?.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim() || null
  return req?.headers.get('x-real-ip')?.trim() || null
}

/**
 * Plafonne le nombre de demandes de contact par IP et par heure (`contacts.create` est publique).
 *
 * Quand l'IP est inconnue (appel serveur à serveur, tests), on n'applique pas de limite : le
 * plafond n'a de sens que pour le trafic entrant.
 */
export const assertContactRequestRateLimit = async (ipHash: string | null): Promise<void> => {
  if (!ipHash) return

  const [row] = await db
    .select({ total: count() })
    .from(contactRequests)
    .where(and(eq(contactRequests.ipHash, ipHash), gte(contactRequests.createdAt, new Date(Date.now() - WINDOW_MS))))

  if ((row?.total ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Vous avez transmis trop de demandes de contact. Veuillez réessayer plus tard.',
    })
  }
}
