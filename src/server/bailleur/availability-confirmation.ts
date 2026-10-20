import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { logActivity } from '~/server/services/activity-logger'
import { type AccommodationScope, scopeAccommodationIdCondition } from './accommodation-scope'
import { resumeIfResolved } from './inactivity-suspension'

/**
 * Résidences du bailleur, dans le périmètre de l'appelant, ayant des disponibilités renseignées :
 * par défaut seulement celles qui font l'objet d'une alerte, toutes avec `onlyWarned: false`.
 */
export async function listAvailabilityToConfirm(ownerId: number, scope: AccommodationScope, { onlyWarned = true } = {}) {
  const residences = await db
    .select({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name })
    .from(accommodations)
    .where(
      and(
        eq(accommodations.ownerId, ownerId),
        onlyWarned ? isNotNull(accommodations.staleAvailabilityWarnedAt) : undefined,
        scopeAccommodationIdCondition(scope),
        sql`exists (select 1 from ${accommodationTypologies} where ${accommodationTypologies.accommodationId} = ${accommodations.id} and ${accommodationTypologies.nbAvailable} is not null)`,
      ),
    )
    .orderBy(asc(accommodations.name))
  if (residences.length === 0) return []

  const typologies = await db
    .select({
      accommodationId: accommodationTypologies.accommodationId,
      type: accommodationTypologies.type,
      nbAvailable: accommodationTypologies.nbAvailable,
      nbTotal: accommodationTypologies.nbTotal,
    })
    .from(accommodationTypologies)
    .where(
      and(
        inArray(
          accommodationTypologies.accommodationId,
          residences.map((r) => r.id),
        ),
        isNotNull(accommodationTypologies.nbAvailable),
      ),
    )
    .orderBy(asc(accommodationTypologies.type))

  return residences.map((residence) => ({
    ...residence,
    typologies: typologies.filter((t) => t.accommodationId === residence.id).map(({ accommodationId, ...t }) => t),
  }))
}

type ConfirmAvailabilityInput = {
  owner: { id: number; name: string }
  scope: AccommodationScope
  user: { id: string; name: string }
  onlyWarned?: boolean
}

/** « Rien n'a changé » : horodate les disponibilités renseignées et lève l'alerte, comme un enregistrement sans modification. */
export async function confirmAvailability({ owner, scope, user, onlyWarned = true }: ConfirmAvailabilityInput) {
  const residences = await listAvailabilityToConfirm(owner.id, scope, { onlyWarned })
  if (residences.length === 0) return { confirmed: 0 }

  const ids = residences.map((r) => r.id)
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(accommodationTypologies)
      .set({ availabilityUpdatedAt: now, availabilityUpdatedBy: user.id })
      .where(and(inArray(accommodationTypologies.accommodationId, ids), isNotNull(accommodationTypologies.nbAvailable)))
    await tx.update(accommodations).set({ staleAvailabilityWarnedAt: null, updatedAt: now }).where(inArray(accommodations.id, ids))
  })

  for (const residence of residences) {
    await resumeIfResolved(residence.id, now)
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: 'accommodation.availability_confirmed',
      entityType: 'accommodation',
      entityName: residence.name,
      ownerId: owner.id,
      ownerName: owner.name,
      metadata: { slug: residence.slug },
    })
  }

  return { confirmed: residences.length }
}
