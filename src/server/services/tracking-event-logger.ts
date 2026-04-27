import { and, eq, gte } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { trackingEvents } from '~/server/db/schema/tracking-events'

export type TrackingEventType = 'search.city' | 'search.department' | 'accommodation.viewed' | 'accommodation.consult_offer'

type LogTrackingEventParams = {
  type: TrackingEventType
  cityId?: number
  departmentId?: number
  accommodationId?: number
  ownerId?: number
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
  /**
   * If set, skip insert when an event of the same type for the same target
   * already exists for this sessionId within the last `dedupeSeconds` seconds.
   */
  dedupeSeconds?: number
}

export async function logTrackingEvent({ dedupeSeconds, ...values }: LogTrackingEventParams) {
  try {
    if (dedupeSeconds && values.sessionId) {
      const since = new Date(Date.now() - dedupeSeconds * 1000)
      const conditions = [
        eq(trackingEvents.type, values.type),
        eq(trackingEvents.sessionId, values.sessionId),
        gte(trackingEvents.createdAt, since),
      ]
      if (values.accommodationId !== undefined) conditions.push(eq(trackingEvents.accommodationId, values.accommodationId))
      else if (values.cityId !== undefined) conditions.push(eq(trackingEvents.cityId, values.cityId))
      else if (values.departmentId !== undefined) conditions.push(eq(trackingEvents.departmentId, values.departmentId))

      const [existing] = await db
        .select({ id: trackingEvents.id })
        .from(trackingEvents)
        .where(and(...conditions))
        .limit(1)
      if (existing) return
    }

    await db.insert(trackingEvents).values(values)
  } catch (err) {
    console.error('[tracking-event-logger] insert failed', { type: values.type, err })
  }
}

export const TRACKING_DEDUPE = {
  SEARCH_SECONDS: 60,
  VIEW_SECONDS: 60 * 60 * 24,
} as const

/**
 * Helper to log an accommodation page view. Resolves ownerId/cityId from the
 * accommodation row, applies a 24h dedup window per (sessionId, accommodationId).
 * Pass the accommodation id (preferred) or the slug.
 */
export async function logAccommodationView(params: {
  accommodationId?: number
  accommodationSlug?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}) {
  try {
    const where = params.accommodationId
      ? eq(accommodations.id, params.accommodationId)
      : params.accommodationSlug
        ? eq(accommodations.slug, params.accommodationSlug)
        : null
    if (!where) return

    const [accom] = await db
      .select({
        id: accommodations.id,
        ownerId: accommodations.ownerId,
        cityId: accommodationAddresses.cityId,
      })
      .from(accommodations)
      .leftJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .where(where)
      .limit(1)
    if (!accom) return

    await logTrackingEvent({
      type: 'accommodation.viewed',
      accommodationId: accom.id,
      ownerId: accom.ownerId ?? undefined,
      cityId: accom.cityId ?? undefined,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
      dedupeSeconds: TRACKING_DEDUPE.VIEW_SECONDS,
    })
  } catch (err) {
    console.error('[tracking-event-logger] logAccommodationView failed', err)
  }
}
