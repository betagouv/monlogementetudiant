import { QueryClient } from '@tanstack/react-query'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { getServerSession } from '~/auth'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { owners } from '~/server/db/schema/owners'
import { mapToGeoJsonFeature, priceMaxComputed } from '~/server/trpc/routers/accommodations'

const PAGE_SIZE = 20

export const myAccommodationsQueryKey = (page?: string | null, disponible?: string | null, recherche?: string | null) =>
  ['my-accommodations', page ? Number(page) : null, disponible === 'true' ? true : null, recherche || null] as const

export const getMyAccommodations = async (searchParams?: {
  page?: string
  disponible?: string
  recherche?: string
}): Promise<TGetAccomodationsResponse> => {
  const auth = await getServerSession()

  if (!auth) {
    throw new Error('Unauthorized')
  }

  const userId = auth.user.id

  // Find owner for this user
  const [owner] = await db.select().from(owners).where(eq(owners.userId, userId)).limit(1)

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
  const hasAvailability = searchParams?.disponible === 'true' ? true : searchParams?.disponible === 'false' ? false : undefined
  const search = searchParams?.recherche

  const conditions = [eq(accommodations.ownerId, owner.id)]

  if (hasAvailability === true) {
    conditions.push(eq(accommodations.available, true))
  } else if (hasAvailability === false) {
    conditions.push(eq(accommodations.available, false))
  }

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
        address: accommodations.address,
        city: accommodations.city,
        postalCode: accommodations.postalCode,
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
        priceMaxComputed,
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
      .from(accommodations)
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(where)
      .orderBy(accommodations.name)
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

export const prefetchMyAccommodations = async (searchParams?: { page?: string; disponible?: string; recherche?: string }) => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: myAccommodationsQueryKey(searchParams?.page, searchParams?.disponible, searchParams?.recherche),
    queryFn: () => getMyAccommodations(searchParams),
  })

  return queryClient
}
