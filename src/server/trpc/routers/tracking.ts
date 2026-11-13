import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { logAccommodationView, logTrackingEvent, TRACKING_DEDUPE } from '~/server/services/tracking-event-logger'
import { getOrCreateTrackingSessionId } from '~/server/services/tracking-session'
import { baseProcedure, createTRPCRouter } from '../init'

const logAccommodationClick = async (
  type: 'accommodation.consult_offer' | 'owner.landing_click',
  slug: string,
  userId: string | undefined,
) => {
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
    .where(and(eq(accommodations.slug, slug), eq(accommodations.published, true)))
    .limit(1)
  if (!accom) return

  const sessionId = await getOrCreateTrackingSessionId()
  await logTrackingEvent({
    type,
    accommodationId: accom.id,
    ownerId: accom.ownerId ?? undefined,
    cityId: accom.cityId ?? undefined,
    userId,
    sessionId,
    dedupeSeconds: TRACKING_DEDUPE.CONSULT_OFFER_SECONDS,
  })
}

export const trackingRouter = createTRPCRouter({
  logSearch: baseProcedure
    .input(
      z.object({
        type: z.enum(['city', 'department']),
        id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = await getOrCreateTrackingSessionId()
      await logTrackingEvent({
        type: input.type === 'city' ? 'search.city' : 'search.department',
        cityId: input.type === 'city' ? input.id : undefined,
        departmentId: input.type === 'department' ? input.id : undefined,
        userId: ctx.session?.user.id,
        sessionId,
        dedupeSeconds: TRACKING_DEDUPE.SEARCH_SECONDS,
      })
    }),

  logAccommodationView: baseProcedure
    .input(
      // Pas de `referer` : non exploité, et susceptible de contenir des données personnelles.
      z.object({
        accommodationId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = await getOrCreateTrackingSessionId()
      await logAccommodationView({
        accommodationId: input.accommodationId,
        userId: ctx.session?.user.id,
        sessionId,
      })
    }),

  logConsultOffer: baseProcedure
    .input(z.object({ accommodationSlug: z.string().min(1) }))
    .mutation(({ ctx, input }) => logAccommodationClick('accommodation.consult_offer', input.accommodationSlug, ctx.session?.user.id)),

  logOwnerLandingClick: baseProcedure
    .input(z.object({ accommodationSlug: z.string().min(1) }))
    .mutation(({ ctx, input }) => logAccommodationClick('owner.landing_click', input.accommodationSlug, ctx.session?.user.id)),
})
