import { and, eq, ilike, sql } from 'drizzle-orm'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { mapToGeoJsonFeature, priceMaxComputed } from '~/server/trpc/routers/accommodations'
import { getQueryClient } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

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

  const usr = await db.query.user.findFirst({ where: eq(user.id, auth.user.id), with: { owner: true } })
  const owner = usr?.owner

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
    db.query.accommodations.findMany({
      where,
      with: { owner: true },
      extras: {
        priceMaxComputed: priceMaxComputed.as('priceMaxComputed'),
        lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`.as('lat'),
        lng: sql<number>`ST_X(${accommodations.geom}::geometry)`.as('lng'),
      },
      orderBy: accommodations.name,
      limit: PAGE_SIZE,
      offset,
    }),
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
      features: results.map((row) =>
        mapToGeoJsonFeature({
          ...row,
          ownerName: row.owner?.name ?? null,
          ownerUrl: row.owner?.url ?? null,
        }),
      ),
    },
  }
}

export const prefetchMyAccommodations = async (searchParams?: { page?: string; disponible?: string; recherche?: string }) => {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: myAccommodationsQueryKey(searchParams?.page, searchParams?.disponible, searchParams?.recherche),
    queryFn: () => getMyAccommodations(searchParams),
  })

  return queryClient
}
