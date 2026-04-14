import { TRPCError } from '@trpc/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { owners } from '~/server/db/schema/owners'
import { createTRPCRouter, userProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

export const favoritesRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const results = await db
      .select({
        id: favoriteAccommodations.id,
        createdAt: favoriteAccommodations.createdAt,
        accommodationId: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        description: accommodations.description,
        address: accommodationAddresses.address,
        city: cities.name,
        citySlug: cities.slug,
        postalCode: accommodationAddresses.postalCode,
        residenceType: accommodations.residenceType,
        targetAudience: accommodations.target_audience,
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
        superficieMinT1: accommodations.superficieMinT1,
        superficieMaxT1: accommodations.superficieMaxT1,
        superficieMinT1Bis: accommodations.superficieMinT1Bis,
        superficieMaxT1Bis: accommodations.superficieMaxT1Bis,
        superficieMinT2: accommodations.superficieMinT2,
        superficieMaxT2: accommodations.superficieMaxT2,
        superficieMinT3: accommodations.superficieMinT3,
        superficieMaxT3: accommodations.superficieMaxT3,
        superficieMinT4: accommodations.superficieMinT4,
        superficieMaxT4: accommodations.superficieMaxT4,
        superficieMinT5: accommodations.superficieMinT5,
        superficieMaxT5: accommodations.superficieMaxT5,
        superficieMinT6: accommodations.superficieMinT6,
        superficieMaxT6: accommodations.superficieMaxT6,
        superficieMinT7More: accommodations.superficieMinT7More,
        superficieMaxT7More: accommodations.superficieMaxT7More,
        priceMaxComputed: priceMaxComputed,
        acceptWaitingList: accommodations.acceptWaitingList,
        scholarshipHoldersPriority: accommodations.scholarshipHoldersPriority,
        socialHousingRequired: accommodations.socialHousingRequired,
        wifi: accommodations.wifi,
        imagesUrls: accommodations.imagesUrls,
        externalUrl: accommodations.externalUrl,
        virtualTourUrl: accommodations.virtualTourUrl,
        updatedAt: accommodations.updatedAt,
        ownerName: owners.name,
        ownerUrl: owners.url,
        lat: sql<number>`ST_Y(${accommodationAddresses.geom}::geometry)`,
        lng: sql<number>`ST_X(${accommodationAddresses.geom}::geometry)`,
      })
      .from(favoriteAccommodations)
      .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
      .innerJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(and(eq(favoriteAccommodations.userId, userId), eq(accommodations.published, true)))
      .orderBy(desc(favoriteAccommodations.createdAt))

    return results.map((row) => ({
      id: row.id,
      accommodation: mapToGeoJsonFeature({
        id: row.accommodationId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        address: row.address,
        city: row.city,
        citySlug: row.citySlug,
        postalCode: row.postalCode,
        residenceType: row.residenceType,
        targetAudience: row.targetAudience,
        published: row.published,
        available: row.available,
        nbTotalApartments: row.nbTotalApartments,
        nbAccessibleApartments: row.nbAccessibleApartments,
        nbColivingApartments: row.nbColivingApartments,
        nbT1: row.nbT1,
        nbT1Bis: row.nbT1Bis,
        nbT2: row.nbT2,
        nbT3: row.nbT3,
        nbT4: row.nbT4,
        nbT5: row.nbT5,
        nbT6: row.nbT6,
        nbT7More: row.nbT7More,
        nbT1Available: row.nbT1Available,
        nbT1BisAvailable: row.nbT1BisAvailable,
        nbT2Available: row.nbT2Available,
        nbT3Available: row.nbT3Available,
        nbT4Available: row.nbT4Available,
        nbT5Available: row.nbT5Available,
        nbT6Available: row.nbT6Available,
        nbT7MoreAvailable: row.nbT7MoreAvailable,
        priceMin: row.priceMin,
        priceMinT1: row.priceMinT1,
        priceMaxT1: row.priceMaxT1,
        priceMinT1Bis: row.priceMinT1Bis,
        priceMaxT1Bis: row.priceMaxT1Bis,
        priceMinT2: row.priceMinT2,
        priceMaxT2: row.priceMaxT2,
        priceMinT3: row.priceMinT3,
        priceMaxT3: row.priceMaxT3,
        priceMinT4: row.priceMinT4,
        priceMaxT4: row.priceMaxT4,
        priceMinT5: row.priceMinT5,
        priceMaxT5: row.priceMaxT5,
        priceMinT6: row.priceMinT6,
        priceMaxT6: row.priceMaxT6,
        priceMinT7More: row.priceMinT7More,
        priceMaxT7More: row.priceMaxT7More,
        superficieMinT1: row.superficieMinT1,
        superficieMaxT1: row.superficieMaxT1,
        superficieMinT1Bis: row.superficieMinT1Bis,
        superficieMaxT1Bis: row.superficieMaxT1Bis,
        superficieMinT2: row.superficieMinT2,
        superficieMaxT2: row.superficieMaxT2,
        superficieMinT3: row.superficieMinT3,
        superficieMaxT3: row.superficieMaxT3,
        superficieMinT4: row.superficieMinT4,
        superficieMaxT4: row.superficieMaxT4,
        superficieMinT5: row.superficieMinT5,
        superficieMaxT5: row.superficieMaxT5,
        superficieMinT6: row.superficieMinT6,
        superficieMaxT6: row.superficieMaxT6,
        superficieMinT7More: row.superficieMinT7More,
        superficieMaxT7More: row.superficieMaxT7More,
        priceMaxComputed: row.priceMaxComputed,
        acceptWaitingList: row.acceptWaitingList,
        scholarshipHoldersPriority: row.scholarshipHoldersPriority,
        socialHousingRequired: row.socialHousingRequired,
        wifi: row.wifi,
        imagesUrls: row.imagesUrls,
        externalUrl: row.externalUrl,
        virtualTourUrl: row.virtualTourUrl,
        updatedAt: row.updatedAt,
        ownerName: row.ownerName,
        ownerUrl: row.ownerUrl,
        lat: row.lat,
        lng: row.lng,
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
