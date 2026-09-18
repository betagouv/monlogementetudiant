import * as Sentry from '@sentry/nextjs'
import { and, eq, exists, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '~/server/db'
import { contactRequests, favoriteAccommodations } from '~/server/db/schema'

/**
 * Rattache au compte les demandes de contact confirmées laissées en visiteur avec la même adresse e-mail.
 * À appeler uniquement une fois l'adresse du compte vérifiée. Les demandes non confirmées restent visiteur.
 *
 * `contact_request` est unique sur `(user_id, accommodation_id)` : une demande visiteur en doublon d'une
 * demande existante du compte est supprimée plutôt que rattachée.
 */
export const linkGuestContactRequests = async (userId: string, email: string): Promise<number> => {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return 0

  const isGuestWithSameEmail = and(isNull(contactRequests.userId), sql`lower(${contactRequests.email}) = ${normalized}`)

  return db.transaction(async (tx) => {
    const owned = alias(contactRequests, 'owned')
    await tx.delete(contactRequests).where(
      and(
        isGuestWithSameEmail,
        exists(
          tx
            .select({ n: sql`1` })
            .from(owned)
            .where(and(eq(owned.userId, userId), eq(owned.accommodationId, contactRequests.accommodationId))),
        ),
      ),
    )

    const linked = await tx
      .update(contactRequests)
      .set({ userId, updatedAt: new Date() })
      .where(and(isGuestWithSameEmail, isNotNull(contactRequests.confirmedAt)))
      .returning({ accommodationId: contactRequests.accommodationId })

    // Mêmes règles que pour une candidature faite en étant connecté : la résidence rejoint les
    // favoris, seul endroit de l'espace étudiant où la candidature est restituée.
    if (linked.length > 0) {
      await tx
        .insert(favoriteAccommodations)
        .values(linked.map(({ accommodationId }) => ({ userId, accommodationId })))
        .onConflictDoNothing()
    }

    return linked.length
  })
}

/** Variante non bloquante : un échec de rattachement ne doit jamais empêcher une connexion. */
export const linkGuestContactRequestsSafely = async (userId: string, email: string): Promise<void> => {
  try {
    await linkGuestContactRequests(userId, email)
  } catch (error) {
    Sentry.captureException(error, { tags: { step: 'linkGuestContactRequests' }, extra: { userId } })
  }
}
