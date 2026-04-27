import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { logTrackingEvent, TRACKING_DEDUPE } from '~/server/services/tracking-event-logger'
import { getOrCreateTrackingSessionId } from '~/server/services/tracking-session'
import { baseProcedure, createTRPCRouter } from '../init'

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

  logConsultOffer: baseProcedure.input(z.object({ accommodationSlug: z.string().min(1) })).mutation(async ({ ctx, input }) => {
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
      .where(eq(accommodations.slug, input.accommodationSlug))
      .limit(1)
    if (!accom) return

    const sessionId = await getOrCreateTrackingSessionId()
    await logTrackingEvent({
      type: 'accommodation.consult_offer',
      accommodationId: accom.id,
      ownerId: accom.ownerId ?? undefined,
      cityId: accom.cityId ?? undefined,
      userId: ctx.session?.user.id,
      sessionId,
    })
  }),
})
