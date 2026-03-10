import { TRPCError } from '@trpc/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { createTRPCRouter, protectedProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

export const favoritesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const results = await db.query.favoriteAccommodations.findMany({
      where: eq(favoriteAccommodations.userId, userId),
      orderBy: desc(favoriteAccommodations.createdAt),
      with: {
        accommodation: {
          with: { owner: true },
          extras: {
            priceMaxComputed: priceMaxComputed.as('priceMaxComputed'),
            lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`.as('lat'),
            lng: sql<number>`ST_X(${accommodations.geom}::geometry)`.as('lng'),
          },
        },
      },
    })

    return results.map((row) => ({
      id: row.id,
      accommodation: mapToGeoJsonFeature({
        ...row.accommodation,
        ownerName: row.accommodation.owner?.name ?? null,
        ownerUrl: row.accommodation.owner?.url ?? null,
      }),
      created_at: row.createdAt,
    }))
  }),

  add: protectedProcedure.input(z.object({ accommodationSlug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const accom = await db.query.accommodations.findFirst({
      where: eq(accommodations.slug, input.accommodationSlug),
      columns: { id: true },
    })

    if (!accom) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Accommodation not found: ${input.accommodationSlug}` })
    }

    const [row] = await db
      .insert(favoriteAccommodations)
      .values({
        userId,
        accommodationId: accom.id,
      })
      .onConflictDoNothing()
      .returning()

    if (!row) {
      const existing = await db.query.favoriteAccommodations.findFirst({
        where: and(eq(favoriteAccommodations.userId, userId), eq(favoriteAccommodations.accommodationId, accom.id)),
      })
      return existing!
    }

    return row
  }),

  remove: protectedProcedure.input(z.object({ slug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    await db
      .delete(favoriteAccommodations)
      .where(
        and(
          eq(favoriteAccommodations.userId, userId),
          sql`${favoriteAccommodations.accommodationId} = (SELECT ${accommodations.id} FROM ${accommodations} WHERE ${accommodations.slug} = ${input.slug} LIMIT 1)`,
        ),
      )

    return { success: true }
  }),
})
