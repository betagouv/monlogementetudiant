import { TRPCError } from '@trpc/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { owners } from '~/server/db/schema/owners'
import { createTRPCRouter, userProcedure } from '../init'
import { owners } from '~/server/db/schema/owners'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

export const favoritesRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const results = await db
      .select({
        id: favoriteAccommodations.id,
        createdAt: favoriteAccommodations.createdAt,
        accommodation: {
          ...accommodations,
          priceMaxComputed: priceMaxComputed,
          lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`,
          lng: sql<number>`ST_X(${accommodations.geom}::geometry)`,
          ownerName: owners.name,
          ownerUrl: owners.url,
        },
      })
      .from(favoriteAccommodations)
      .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(and(eq(favoriteAccommodations.userId, userId), eq(accommodations.published, true)))
      .orderBy(desc(favoriteAccommodations.createdAt))

    return results.map((row) => ({
      id: row.id,
      accommodation: mapToGeoJsonFeature({
        ...row.accommodation,
      }),
      created_at: row.createdAt,
    }))
  }),

  add: userProcedure.input(z.object({ accommodationSlug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const accom = await db.query.accommodations.findFirst({
      where: eq(accommodations.slug, input.accommodationSlug),
      columns: { id: true },
    })

    if (!accom) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `[favorites.add] Accommodation not found: ${input.accommodationSlug}` })
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

  remove: userProcedure.input(z.object({ slug: z.string() })).mutation(async ({ ctx, input }) => {
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
