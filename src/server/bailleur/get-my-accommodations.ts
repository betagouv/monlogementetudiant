import { and, eq, ilike, sql } from 'drizzle-orm'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { user } from '~/server/db/schema/auth'
import { mapToGeoJsonFeature, priceMaxComputed } from '~/server/trpc/routers/accommodations'
import { getQueryClient } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

const PAGE_SIZE = 20

export const myAccommodationsQueryKey = (
  page?: string | null,
  disponible?: string | null,
  recherche?: string | null,
  bailleur?: string | null,
) => ['my-accommodations', page ? Number(page) : null, disponible === 'true' ? true : null, recherche || null, bailleur || null] as const

export const getMyAccommodations = async (searchParams?: {
  page?: string
  disponible?: string
  recherche?: string
  bailleur?: string
}): Promise<TGetAccomodationsResponse> => {
  const auth = await getServerSession()

  if (!auth) {
    throw new Error('Unauthorized')
  }

  let owner: { id: number; name: string; slug: string; url: string | null } | null = null

  if (auth.user.role === 'admin' && searchParams?.bailleur) {
    // Admin with bailleur query param: verify the admin is linked to this owner
    const requestedOwnerId = Number(searchParams.bailleur)
    if (!isNaN(requestedOwnerId)) {
      const link = await db.query.adminOwnerLinks.findFirst({
        where: and(eq(adminOwnerLinks.userId, auth.user.id), eq(adminOwnerLinks.ownerId, requestedOwnerId)),
        with: { owner: true },
      })
      if (link) {
        owner = link.owner
      }
    }
  } else if (auth.user.role === 'admin') {
    // Admin without bailleur param: use first linked owner
    const firstLink = await db.query.adminOwnerLinks.findFirst({
      where: eq(adminOwnerLinks.userId, auth.user.id),
      with: { owner: true },
    })
    if (firstLink) {
      owner = firstLink.owner
    }
  } else {
    // Owner role: use user.ownerId as before
    const usr = await db.query.user.findFirst({ where: eq(user.id, auth.user.id), with: { owner: true } })
    owner = usr?.owner ?? null
  }

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
    db.query.accommodations.findMany({
      where,
      columns: { geom: false },
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

export const prefetchMyAccommodations = async (searchParams?: {
  page?: string
  disponible?: string
  recherche?: string
  bailleur?: string
}) => {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: myAccommodationsQueryKey(searchParams?.page, searchParams?.disponible, searchParams?.recherche, searchParams?.bailleur),
    queryFn: () => getMyAccommodations(searchParams),
  })

  return queryClient
}
