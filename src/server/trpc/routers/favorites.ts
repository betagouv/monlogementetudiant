import { TRPCError } from '@trpc/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { owners } from '~/server/db/schema/owners'
import { createTRPCRouter, protectedProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

export const favoritesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const results = await db
      .select({
        favoriteId: favoriteAccommodations.id,
        createdAt: favoriteAccommodations.createdAt,
        id: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        description: accommodations.description,
        address: accommodations.address,
        city: accommodations.city,
        postalCode: accommodations.postalCode,
        residenceType: accommodations.residenceType,
        published: accommodations.published,
        available: accommodations.available,
        nbTotalApartments: accommodations.nbTotalApartments,
        nbAccessibleApartments: accommodations.nbAccessibleApartments,
        nbColivingApartments: accommodations.nbColivingApartments,
        nbT1: accommodations.nbT1,
        nbT1Bis: accommodations.nbT1Bis,
        nbT2: accommodations.nbT2,
        nbT3: accommodations.nbT3,
        nbT4: accommodations.nbT4,
        nbT5: accommodations.nbT5,
        nbT6: accommodations.nbT6,
        nbT7More: accommodations.nbT7More,
        nbT1Available: accommodations.nbT1Available,
        nbT1BisAvailable: accommodations.nbT1BisAvailable,
        nbT2Available: accommodations.nbT2Available,
        nbT3Available: accommodations.nbT3Available,
        nbT4Available: accommodations.nbT4Available,
        nbT5Available: accommodations.nbT5Available,
        nbT6Available: accommodations.nbT6Available,
        nbT7MoreAvailable: accommodations.nbT7MoreAvailable,
        priceMin: accommodations.priceMin,
        priceMinT1: accommodations.priceMinT1,
        priceMaxT1: accommodations.priceMaxT1,
        priceMinT1Bis: accommodations.priceMinT1Bis,
        priceMaxT1Bis: accommodations.priceMaxT1Bis,
        priceMinT2: accommodations.priceMinT2,
        priceMaxT2: accommodations.priceMaxT2,
        priceMinT3: accommodations.priceMinT3,
        priceMaxT3: accommodations.priceMaxT3,
        priceMinT4: accommodations.priceMinT4,
        priceMaxT4: accommodations.priceMaxT4,
        priceMinT5: accommodations.priceMinT5,
        priceMaxT5: accommodations.priceMaxT5,
        priceMinT6: accommodations.priceMinT6,
        priceMaxT6: accommodations.priceMaxT6,
        priceMinT7More: accommodations.priceMinT7More,
        priceMaxT7More: accommodations.priceMaxT7More,
        priceMaxComputed: priceMaxComputed,
        acceptWaitingList: accommodations.acceptWaitingList,
        scholarshipHoldersPriority: accommodations.scholarshipHoldersPriority,
        wifi: accommodations.wifi,
        imagesUrls: accommodations.imagesUrls,
        externalUrl: accommodations.externalUrl,
        updatedAt: accommodations.updatedAt,
        ownerName: owners.name,
        ownerUrl: owners.url,
        lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`,
        lng: sql<number>`ST_X(${accommodations.geom}::geometry)`,
      })
      .from(favoriteAccommodations)
      .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(eq(favoriteAccommodations.userId, userId))
      .orderBy(desc(favoriteAccommodations.createdAt))

    return results.map((row) => ({
      id: row.favoriteId,
      accommodation: mapToGeoJsonFeature(row),
      created_at: row.createdAt,
    }))
  }),

  add: protectedProcedure.input(z.object({ accommodationSlug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const accom = await db
      .select({ id: accommodations.id })
      .from(accommodations)
      .where(eq(accommodations.slug, input.accommodationSlug))
      .limit(1)

    if (!accom[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Accommodation not found: ${input.accommodationSlug}` })
    }

    const [row] = await db
      .insert(favoriteAccommodations)
      .values({
        userId,
        accommodationId: accom[0].id,
      })
      .onConflictDoNothing()
      .returning()

    if (!row) {
      const existing = await db
        .select()
        .from(favoriteAccommodations)
        .where(and(eq(favoriteAccommodations.userId, userId), eq(favoriteAccommodations.accommodationId, accom[0].id)))
        .limit(1)
      return existing[0]!
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
