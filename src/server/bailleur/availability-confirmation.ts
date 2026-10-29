import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { logActivity } from '~/server/services/activity-logger'
import { type AccommodationScope, scopeAccommodationIdCondition } from './accommodation-scope'
import { resumeIfResolved } from './inactivity-suspension'

export const withAvailabilityCondition = sql`exists (select 1 from ${accommodationTypologies} where ${accommodationTypologies.accommodationId} = ${accommodations.id} and ${accommodationTypologies.nbAvailable} is not null)`

/** Adresse principale, unique par résidence : la jointure ne duplique pas les lignes. */
export const mainAddressJoin = and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true))

/** Typologies renseignées des résidences, avec le total disponible et la dernière mise à jour par résidence. */
export async function loadAvailabilitySummaries(accommodationIds: number[]) {
  if (accommodationIds.length === 0) return new Map<number, AvailabilitySummary>()
  const rows = await db
    .select({
      accommodationId: accommodationTypologies.accommodationId,
      type: accommodationTypologies.type,
      nbAvailable: accommodationTypologies.nbAvailable,
      nbTotal: accommodationTypologies.nbTotal,
      availabilityUpdatedAt: accommodationTypologies.availabilityUpdatedAt,
    })
    .from(accommodationTypologies)
    .where(and(inArray(accommodationTypologies.accommodationId, accommodationIds), isNotNull(accommodationTypologies.nbAvailable)))
    .orderBy(asc(accommodationTypologies.type))

  const summaries = new Map<number, AvailabilitySummary>()
  for (const { accommodationId, availabilityUpdatedAt, ...typology } of rows) {
    const summary = summaries.get(accommodationId) ?? { nbAvailable: 0, lastUpdatedAt: null, typologies: [] }
    summary.nbAvailable += typology.nbAvailable ?? 0
    if (availabilityUpdatedAt && (!summary.lastUpdatedAt || availabilityUpdatedAt > summary.lastUpdatedAt)) {
      summary.lastUpdatedAt = availabilityUpdatedAt
    }
    summary.typologies.push(typology)
    summaries.set(accommodationId, summary)
  }
  return summaries
}

type AvailabilitySummary = {
  nbAvailable: number
  lastUpdatedAt: Date | null
  typologies: { type: (typeof accommodationTypologies.$inferSelect)['type']; nbAvailable: number | null; nbTotal: number | null }[]
}

/**
 * Résidences du bailleur, dans le périmètre de l'appelant, ayant des disponibilités renseignées :
 * par défaut seulement celles qui font l'objet d'une alerte, toutes avec `onlyWarned: false`.
 */
export async function listAvailabilityToConfirm(ownerId: number, scope: AccommodationScope, { onlyWarned = true } = {}) {
  const residences = await db
    .select({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name, city: cities.name })
    .from(accommodations)
    .leftJoin(accommodationAddresses, mainAddressJoin)
    .leftJoin(cities, eq(cities.id, accommodationAddresses.cityId))
    .where(
      and(
        eq(accommodations.ownerId, ownerId),
        onlyWarned ? isNotNull(accommodations.staleAvailabilityWarnedAt) : undefined,
        scopeAccommodationIdCondition(scope),
        withAvailabilityCondition,
      ),
    )
    .orderBy(asc(accommodations.name))
  if (residences.length === 0) return []

  const summaries = await loadAvailabilitySummaries(residences.map((r) => r.id))
  return residences.map((residence) => {
    const summary = summaries.get(residence.id)
    return {
      ...residence,
      nbAvailable: summary?.nbAvailable ?? 0,
      lastUpdatedAt: summary?.lastUpdatedAt ?? null,
      typologies: summary?.typologies ?? [],
    }
  })
}

type ConfirmAvailabilityInput = {
  owner: { id: number; name: string }
  scope: AccommodationScope
  user: { id: string; name: string }
  onlyWarned?: boolean
  /** Seules les disponibilités inchangées depuis cette date sont confirmées : une saisie plus récente n'est jamais écrasée. */
  notUpdatedSince?: Date
  via?: 'email'
}

/** « Rien n'a changé » : horodate les disponibilités renseignées et lève l'alerte, comme un enregistrement sans modification. */
export async function confirmAvailability({ owner, scope, user, onlyWarned = true, notUpdatedSince, via }: ConfirmAvailabilityInput) {
  const residences = await listAvailabilityToConfirm(owner.id, scope, { onlyWarned })
  if (residences.length === 0) return { confirmed: 0, skipped: 0 }

  const now = new Date()
  const bound = notUpdatedSince && notUpdatedSince < now ? notUpdatedSince : now
  const confirmedIds = await db.transaction(async (tx) => {
    const stamped = await tx
      .update(accommodationTypologies)
      .set({ availabilityUpdatedAt: now, availabilityUpdatedBy: user.id })
      .where(
        and(
          inArray(
            accommodationTypologies.accommodationId,
            residences.map((r) => r.id),
          ),
          isNotNull(accommodationTypologies.nbAvailable),
          or(isNull(accommodationTypologies.availabilityUpdatedAt), lte(accommodationTypologies.availabilityUpdatedAt, bound)),
        ),
      )
      .returning({ accommodationId: accommodationTypologies.accommodationId })
    const ids = [...new Set(stamped.map((row) => row.accommodationId))]
    if (ids.length > 0) {
      await tx.update(accommodations).set({ staleAvailabilityWarnedAt: null, updatedAt: now }).where(inArray(accommodations.id, ids))
    }
    return new Set(ids)
  })

  for (const residence of residences.filter((r) => confirmedIds.has(r.id))) {
    await resumeIfResolved(residence.id, now)
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: 'accommodation.availability_confirmed',
      entityType: 'accommodation',
      entityName: residence.name,
      ownerId: owner.id,
      ownerName: owner.name,
      metadata: via ? { slug: residence.slug, via } : { slug: residence.slug },
    })
  }

  return { confirmed: confirmedIds.size, skipped: residences.length - confirmedIds.size }
}
