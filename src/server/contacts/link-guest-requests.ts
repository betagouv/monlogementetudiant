import * as Sentry from '@sentry/nextjs'
import { and, eq, exists, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '~/server/db'
import { contactRequests, favoriteAccommodations } from '~/server/db/schema'

/**
 * Rattache au compte les demandes de contact laissées en visiteur avec la même adresse e-mail.
 *
 * Appelé uniquement quand l'adresse est prouvée (vérification d'e-mail à l'inscription, ou ouverture
 * de session sur un compte déjà vérifié) : sans cette garantie, n'importe qui pourrait s'approprier
 * les demandes d'autrui en s'inscrivant avec leur adresse.
 *
 * `contact_request` porte une contrainte d'unicité `(user_id, accommodation_id)` : si le compte a
 * déjà une demande sur la même résidence, la ligne visiteur est un doublon et on la supprime au lieu
 * de la rattacher (sinon l'UPDATE violerait la contrainte et ferait échouer la connexion).
 *
 * Seules les demandes **confirmées** sont rattachées : prouver son adresse ne prouve pas être l'auteur
 * d'une demande déposée avec elle. Sans ce filtre, un tiers pourrait déposer une demande au nom d'un
 * étudiant (avec son propre téléphone) et la rendre visible du gestionnaire sans double opt-in, puisque
 * toute demande liée à un compte est visible. Les non confirmées restent visiteur jusqu'à confirmation
 * ou purge.
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
