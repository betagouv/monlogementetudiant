import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { mapToGeoJsonFeature, priceMaxComputed } from '~/server/trpc/routers/accommodations'
import { getQueryClient } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

const PAGE_SIZE = 20

export const myAccommodationsQueryKey = (
  page?: string | null,
  disponible?: string | null,
  recherche?: string | null,
  ownerId?: string | null,
) => ['my-accommodations', page ? Number(page) : null, disponible === 'true' ? true : null, recherche || null, ownerId || null] as const

export const getMyAccommodations = async (searchParams?: {
  page?: string
  disponible?: string
  recherche?: string
  ownerId?: string
}): Promise<TGetAccomodationsResponse> => {
  const auth = await getServerSession()

  if (!auth) {
    throw new Error('Unauthorized')
  }

  const ownerId = searchParams?.ownerId ? Number(searchParams.ownerId) : undefined
  const owner = await getOwnerForUser(auth.user.id, ownerId)

  if (!owner) {
    return {
      count: 0,
      page_size: PAGE_SIZE,
      next: null,
      previous: null,
      min_price: null,
      max_price: null,
      results: { features: [] },
    }
  }

  const page = searchParams?.page ? Number(searchParams.page) : 1
  const search = searchParams?.recherche

  const conditions = [eq(accommodations.ownerId, owner.id)]

  if (search && search.length >= 3) {
    conditions.push(ilike(accommodations.name, `%${search}%`))
  }

  const where = and(...conditions)
  const offset = (page - 1) * PAGE_SIZE

  const [countResult, priceBounds, results] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(accommodations).where(where),
    db
      .select({
        minPrice: sql<number | null>`MIN(${accommodations.priceMin})`,
        maxPrice: sql<number | null>`MAX(${priceMaxComputed})`,
      })
      .from(accommodations)
      .where(where),
    db
      .select({
        id: accommodations.id,
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
      .from(accommodations)
      .innerJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(where)
      .orderBy(desc(accommodations.published), accommodations.name)
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const count = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return {
    count,
    page_size: PAGE_SIZE,
    next: page < totalPages ? String(page + 1) : null,
    previous: page > 1 ? String(page - 1) : null,
    min_price: priceBounds[0]?.minPrice != null ? Number(priceBounds[0].minPrice) : null,
    max_price: priceBounds[0]?.maxPrice != null ? Number(priceBounds[0].maxPrice) : null,
    results: {
      features: results.map(mapToGeoJsonFeature),
    },
  }
}

export const prefetchMyAccommodations = async (searchParams?: {
  page?: string
  disponible?: string
  recherche?: string
  ownerId?: string
}) => {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: myAccommodationsQueryKey(searchParams?.page, searchParams?.disponible, searchParams?.recherche, searchParams?.ownerId),
    queryFn: () => getMyAccommodations(searchParams),
  })

  return queryClient
}
