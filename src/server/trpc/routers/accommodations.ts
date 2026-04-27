import { TRPCError } from '@trpc/server'
import { and, eq, notInArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { externalSources } from '~/server/db/schema/external-sources'
import { owners } from '~/server/db/schema/owners'
import { baseProcedure, createTRPCRouter } from '../init'
import { bboxSelect } from '../utils/spatial-helpers'

const availabilityCols = [
  accommodations.nbT1Available,
  accommodations.nbT1BisAvailable,
  accommodations.nbT2Available,
  accommodations.nbT3Available,
  accommodations.nbT4Available,
  accommodations.nbT5Available,
  accommodations.nbT6Available,
  accommodations.nbT7MoreAvailable,
] as const

// Raw column names used inside CTE ordering (no table qualification)
const totalAvailable = sql<number>`(
  COALESCE("nbT1Available", 0) +
  COALESCE("nbT1BisAvailable", 0) +
  COALESCE("nbT2Available", 0) +
  COALESCE("nbT3Available", 0) +
  COALESCE("nbT4Available", 0) +
  COALESCE("nbT5Available", 0) +
  COALESCE("nbT6Available", 0) +
  COALESCE("nbT7MoreAvailable", 0)
)`

const unknownAvailability = sql<boolean>`(
  "nbT1Available" IS NULL AND
  "nbT1BisAvailable" IS NULL AND
  "nbT2Available" IS NULL AND
  "nbT3Available" IS NULL AND
  "nbT4Available" IS NULL AND
  "nbT5Available" IS NULL AND
  "nbT6Available" IS NULL AND
  "nbT7MoreAvailable" IS NULL
)`

const priorityOrder = sql`CASE
  WHEN ${totalAvailable} > 0 THEN 1
  WHEN ${totalAvailable} = 0 AND "acceptWaitingList" = true AND NOT ${unknownAvailability} THEN 2
  WHEN ${unknownAvailability} AND "acceptWaitingList" = true THEN 3
  WHEN ${unknownAvailability} AND ("acceptWaitingList" IS NULL OR "acceptWaitingList" = false) THEN 4
  WHEN ${totalAvailable} = 0 AND ("acceptWaitingList" IS NULL OR "acceptWaitingList" = false) AND NOT ${unknownAvailability} THEN 5
  ELSE 6
END`

export const priceMaxComputed = sql<number | null>`GREATEST(
  ${accommodations.priceMaxT1},
  ${accommodations.priceMaxT1Bis},
  ${accommodations.priceMaxT2},
  ${accommodations.priceMaxT3},
  ${accommodations.priceMaxT4},
  ${accommodations.priceMaxT5},
  ${accommodations.priceMaxT6},
  ${accommodations.priceMaxT7More}
)`

const residenceTypeValues = new Set<string>(Object.values(EResidenceType))
const targetAudienceValues = new Set<string>(Object.values(ETargetAudience))

function toResidenceType(value: string | null): EResidenceType | null {
  return value && residenceTypeValues.has(value) ? (value as EResidenceType) : null
}

function toTargetAudience(value: string | null): ETargetAudience | null {
  return value && targetAudienceValues.has(value) ? (value as ETargetAudience) : null
}

type TCommonListFiltersInput = {
  hasColiving?: boolean
  isAccessible?: boolean
  onlyWithAvailability?: boolean
  ownerSlug?: string
  priceMax?: number
  viewCrous: boolean
}

const applyCommonListFilters = async (conditions: SQL[], input: TCommonListFiltersInput) => {
  const { hasColiving, isAccessible, onlyWithAvailability, ownerSlug, priceMax, viewCrous } = input

  if (isAccessible) {
    conditions.push(sql`${accommodations.nbAccessibleApartments} > 0`)
  }

  if (hasColiving) {
    conditions.push(sql`${accommodations.nbColivingApartments} > 0`)
  }

  if (onlyWithAvailability) {
    const orAvailable = availabilityCols.map((col) => sql`${col} > 0`)
    conditions.push(sql`(${sql.join(orAvailable, sql` OR `)})`)
  }

  if (priceMax) {
    conditions.push(sql`${accommodations.priceMin} IS NOT NULL AND ${accommodations.priceMin} <= ${priceMax}`)
  }

  if (viewCrous) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${externalSources} WHERE ${externalSources.accommodationId} = ${accommodations.id} AND ${externalSources.source} = 'crous')`,
    )
  } else {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM ${externalSources} WHERE ${externalSources.accommodationId} = ${accommodations.id} AND ${externalSources.source} = 'crous')`,
    )
  }

  if (ownerSlug) {
    const ownerResult = await db.select({ id: owners.id }).from(owners).where(eq(owners.slug, ownerSlug)).limit(1)

    if (ownerResult.length > 0) {
      conditions.push(eq(accommodations.ownerId, ownerResult[0].id))
    }
  }
}

const applyCenterRadiusFilter = (conditions: SQL[], center: string, radius: number) => {
  const [lng, lat] = center.split(',').map(Number)
  const radiusMeters = radius * 1000
  conditions.push(
    sql`ST_DWithin(${accommodationAddresses.geom}::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`,
  )
}

const listAccommodationsWithConditions = async ({
  page,
  pageSize,
  where,
  addressOrderHint,
}: {
  page: number
  pageSize: number
  where: SQL | undefined
  addressOrderHint?: SQL
}) => {
  const offset = (page - 1) * pageSize
  const addressOrder = addressOrderHint ?? sql`${accommodationAddresses.isMain} DESC`
  const whereClause = where ? sql`WHERE ${where}` : sql``

  // Use a CTE: first deduplicate with DISTINCT ON, then sort + paginate on top
  const [countResult, priceBounds, results] = await Promise.all([
    db
      .select({ count: sql<number>`count(DISTINCT ${accommodations.id})::int` })
      .from(accommodations)
      .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .where(where),

    db
      .select({
        minPrice: sql<number | null>`MIN(LEAST(
              NULLIF(${accommodations.priceMinT1}, 0),
              NULLIF(${accommodations.priceMinT1Bis}, 0),
              NULLIF(${accommodations.priceMinT2}, 0),
              NULLIF(${accommodations.priceMinT3}, 0),
              NULLIF(${accommodations.priceMinT4}, 0),
              NULLIF(${accommodations.priceMinT5}, 0),
              NULLIF(${accommodations.priceMinT6}, 0),
              NULLIF(${accommodations.priceMinT7More}, 0)
            ))`,
        maxPrice: sql<number | null>`MAX(GREATEST(
              NULLIF(${accommodations.priceMaxT1}, 0),
              NULLIF(${accommodations.priceMaxT1Bis}, 0),
              NULLIF(${accommodations.priceMaxT2}, 0),
              NULLIF(${accommodations.priceMaxT3}, 0),
              NULLIF(${accommodations.priceMaxT4}, 0),
              NULLIF(${accommodations.priceMaxT5}, 0),
              NULLIF(${accommodations.priceMaxT6}, 0),
              NULLIF(${accommodations.priceMaxT7More}, 0)
            ))`,
      })
      .from(accommodations)
      .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .where(where),

    db.execute<Record<string, unknown>>(sql`
      WITH deduped AS (
        SELECT DISTINCT ON (${accommodations.id})
          ${accommodations.id} as id,
          ${accommodations.name} as name,
          ${accommodations.slug} as slug,
          ${accommodations.description} as description,
          ${accommodationAddresses.address} as address,
          ${cities.name} as city,
          ${cities.slug} as "citySlug",
          ${accommodationAddresses.postalCode} as "postalCode",
          ${accommodations.residenceType} as "residenceType",
          ${accommodations.target_audience} as "targetAudience",
          ${accommodations.published} as published,
          ${accommodations.nbTotalApartments} as "nbTotalApartments",
          ${accommodations.nbAccessibleApartments} as "nbAccessibleApartments",
          ${accommodations.nbColivingApartments} as "nbColivingApartments",
          ${accommodations.nbT1} as "nbT1",
          ${accommodations.nbT1Bis} as "nbT1Bis",
          ${accommodations.nbT2} as "nbT2",
          ${accommodations.nbT3} as "nbT3",
          ${accommodations.nbT4} as "nbT4",
          ${accommodations.nbT5} as "nbT5",
          ${accommodations.nbT6} as "nbT6",
          ${accommodations.nbT7More} as "nbT7More",
          ${accommodations.nbT1Available} as "nbT1Available",
          ${accommodations.nbT1BisAvailable} as "nbT1BisAvailable",
          ${accommodations.nbT2Available} as "nbT2Available",
          ${accommodations.nbT3Available} as "nbT3Available",
          ${accommodations.nbT4Available} as "nbT4Available",
          ${accommodations.nbT5Available} as "nbT5Available",
          ${accommodations.nbT6Available} as "nbT6Available",
          ${accommodations.nbT7MoreAvailable} as "nbT7MoreAvailable",
          ${accommodations.priceMin} as "priceMin",
          ${accommodations.priceMinT1} as "priceMinT1",
          ${accommodations.priceMaxT1} as "priceMaxT1",
          ${accommodations.priceMinT1Bis} as "priceMinT1Bis",
          ${accommodations.priceMaxT1Bis} as "priceMaxT1Bis",
          ${accommodations.priceMinT2} as "priceMinT2",
          ${accommodations.priceMaxT2} as "priceMaxT2",
          ${accommodations.priceMinT3} as "priceMinT3",
          ${accommodations.priceMaxT3} as "priceMaxT3",
          ${accommodations.priceMinT4} as "priceMinT4",
          ${accommodations.priceMaxT4} as "priceMaxT4",
          ${accommodations.priceMinT5} as "priceMinT5",
          ${accommodations.priceMaxT5} as "priceMaxT5",
          ${accommodations.priceMinT6} as "priceMinT6",
          ${accommodations.priceMaxT6} as "priceMaxT6",
          ${accommodations.priceMinT7More} as "priceMinT7More",
          ${accommodations.priceMaxT7More} as "priceMaxT7More",
          ${accommodations.superficieMinT1} as "superficieMinT1",
          ${accommodations.superficieMaxT1} as "superficieMaxT1",
          ${accommodations.superficieMinT1Bis} as "superficieMinT1Bis",
          ${accommodations.superficieMaxT1Bis} as "superficieMaxT1Bis",
          ${accommodations.superficieMinT2} as "superficieMinT2",
          ${accommodations.superficieMaxT2} as "superficieMaxT2",
          ${accommodations.superficieMinT3} as "superficieMinT3",
          ${accommodations.superficieMaxT3} as "superficieMaxT3",
          ${accommodations.superficieMinT4} as "superficieMinT4",
          ${accommodations.superficieMaxT4} as "superficieMaxT4",
          ${accommodations.superficieMinT5} as "superficieMinT5",
          ${accommodations.superficieMaxT5} as "superficieMaxT5",
          ${accommodations.superficieMinT6} as "superficieMinT6",
          ${accommodations.superficieMaxT6} as "superficieMaxT6",
          ${accommodations.superficieMinT7More} as "superficieMinT7More",
          ${accommodations.superficieMaxT7More} as "superficieMaxT7More",
          ${priceMaxComputed} as "priceMaxComputed",
          ${accommodations.acceptWaitingList} as "acceptWaitingList",
          ${accommodations.scholarshipHoldersPriority} as "scholarshipHoldersPriority",
          ${accommodations.socialHousingRequired} as "socialHousingRequired",
          ${accommodations.wifi} as wifi,
          ${accommodations.imagesUrls} as "imagesUrls",
          ${accommodations.externalUrl} as "externalUrl",
          ${accommodations.virtualTourUrl} as "virtualTourUrl",
          ${accommodations.updatedAt} as "updatedAt",
          ${owners.name} as "ownerName",
          ${owners.url} as "ownerUrl",
          ST_Y(${accommodationAddresses.geom}::geometry) as lat,
          ST_X(${accommodationAddresses.geom}::geometry) as lng
        FROM ${accommodations}
        INNER JOIN ${accommodationAddresses} ON ${accommodationAddresses.accommodationId} = ${accommodations.id}
        INNER JOIN ${cities} ON ${cities.id} = ${accommodationAddresses.cityId}
        LEFT JOIN ${owners} ON ${owners.id} = ${accommodations.ownerId}
        ${whereClause}
        ORDER BY ${accommodations.id}, ${addressOrder}
      )
      SELECT * FROM deduped
      ORDER BY ${priorityOrder} ASC, ${totalAvailable} DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
  ])

  const count = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(count / pageSize)

  return {
    count,
    page_size: pageSize,
    min_price: priceBounds[0]?.minPrice != null ? Number(priceBounds[0].minPrice) : null,
    max_price: priceBounds[0]?.maxPrice != null ? Number(priceBounds[0].maxPrice) : null,
    next: page < totalPages ? String(page + 1) : null,
    previous: page > 1 ? String(page - 1) : null,
    results: {
      features: (Array.isArray(results) ? results : (results as { rows: Record<string, unknown>[] }).rows).map(mapToGeoJsonFeature),
    },
  }
}

export function mapToGeoJsonFeature(row: Record<string, unknown>) {
  // bigint columns come back as strings from raw SQL queries (db.execute) but as numbers from typed selects
  const id = typeof row.id === 'string' ? Number(row.id) : (row.id as number)
  return {
    geometry: {
      type: 'Point' as const,
      coordinates: [row.lng as number, row.lat as number],
    },
    id,
    properties: {
      id,
      name: row.name as string,
      slug: row.slug as string,
      address: (row.address as string) ?? '',
      city: row.city as string,
      city_slug: row.citySlug as string,
      postal_code: row.postalCode as string,
      residence_type: toResidenceType((row.residenceType as string | null) ?? null),
      target_audience: toTargetAudience((row.targetAudience as string | null) ?? null),
      published: row.published as boolean,
      accept_waiting_list: (row.acceptWaitingList as boolean) ?? false,
      images_urls: (row.imagesUrls as string[]) ?? null,
      description: (row.description as string) ?? null,
      external_url: (row.externalUrl as string) ?? undefined,
      virtual_tour_url: (row.virtualTourUrl as string) ?? null,
      updated_at: row.updatedAt as Date,
      scholarship_holders_priority: (row.scholarshipHoldersPriority as boolean) ?? false,
      social_housing_required: (row.socialHousingRequired as boolean) ?? false,
      wifi: (row.wifi as boolean) ?? false,
      nb_total_apartments: row.nbTotalApartments as number | null,
      nb_accessible_apartments: row.nbAccessibleApartments as number | null,
      nb_coliving_apartments: row.nbColivingApartments as number | null,
      nb_t1: row.nbT1 as number | null,
      nb_t1_bis: row.nbT1Bis as number | null,
      nb_t2: row.nbT2 as number | null,
      nb_t3: row.nbT3 as number | null,
      nb_t4: row.nbT4 as number | null,
      nb_t5: row.nbT5 as number | null,
      nb_t6: row.nbT6 as number | null,
      nb_t7_more: row.nbT7More as number | null,
      nb_t1_available: row.nbT1Available as number | null,
      nb_t1_bis_available: row.nbT1BisAvailable as number | null,
      nb_t2_available: row.nbT2Available as number | null,
      nb_t3_available: row.nbT3Available as number | null,
      nb_t4_available: row.nbT4Available as number | null,
      nb_t5_available: row.nbT5Available as number | null,
      nb_t6_available: row.nbT6Available as number | null,
      nb_t7_more_available: row.nbT7MoreAvailable as number | null,
      price_min: row.priceMin as number | null,
      price_min_t1: row.priceMinT1 as number | null,
      price_min_t1_bis: row.priceMinT1Bis as number | null,
      price_min_t2: row.priceMinT2 as number | null,
      price_min_t3: row.priceMinT3 as number | null,
      price_min_t4: row.priceMinT4 as number | null,
      price_min_t5: row.priceMinT5 as number | null,
      price_min_t6: row.priceMinT6 as number | null,
      price_min_t7_more: row.priceMinT7More as number | null,
      price_max: row.priceMaxComputed as number | null,
      price_max_t1: row.priceMaxT1 as number | null,
      price_max_t1_bis: row.priceMaxT1Bis as number | null,
      price_max_t2: row.priceMaxT2 as number | null,
      price_max_t3: row.priceMaxT3 as number | null,
      price_max_t4: row.priceMaxT4 as number | null,
      price_max_t5: row.priceMaxT5 as number | null,
      price_max_t6: row.priceMaxT6 as number | null,
      price_max_t7_more: row.priceMaxT7More as number | null,
      superficie_min_t1: row.superficieMinT1 as number | null,
      superficie_max_t1: row.superficieMaxT1 as number | null,
      superficie_min_t1_bis: row.superficieMinT1Bis as number | null,
      superficie_max_t1_bis: row.superficieMaxT1Bis as number | null,
      superficie_min_t2: row.superficieMinT2 as number | null,
      superficie_max_t2: row.superficieMaxT2 as number | null,
      superficie_min_t3: row.superficieMinT3 as number | null,
      superficie_max_t3: row.superficieMaxT3 as number | null,
      superficie_min_t4: row.superficieMinT4 as number | null,
      superficie_max_t4: row.superficieMaxT4 as number | null,
      superficie_min_t5: row.superficieMinT5 as number | null,
      superficie_max_t5: row.superficieMaxT5 as number | null,
      superficie_min_t6: row.superficieMinT6 as number | null,
      superficie_max_t6: row.superficieMaxT6 as number | null,
      superficie_min_t7_more: row.superficieMinT7More as number | null,
      superficie_max_t7_more: row.superficieMaxT7More as number | null,
      owner_name: (row.ownerName as string) ?? null,
      owner_url: (row.ownerUrl as string) ?? null,
    },
  }
}

export const accommodationsRouter = createTRPCRouter({
  list: baseProcedure
    .input(
      z.object({
        bbox: z.string().optional(),
        center: z.string().optional(), // "lng,lat"
        radius: z.number().default(10), // km
        page: z.number().default(1),
        pageSize: z.number().default(12),
        isAccessible: z.boolean().optional(),
        hasColiving: z.boolean().optional(),
        onlyWithAvailability: z.boolean().optional(),
        priceMax: z.number().optional(),
        viewCrous: z.boolean().default(false),
        academyId: z.number().optional(),
        ownerSlug: z.string().optional(),
        cityId: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { bbox, center, radius, page, pageSize, academyId } = input

      const conditions: SQL[] = [eq(accommodations.published, true), sql`${accommodationAddresses.geom} IS NOT NULL`]
      await applyCommonListFilters(conditions, input)

      let addressOrderHint: SQL | undefined
      if (input.cityId) {
        conditions.push(
          sql`ST_Within(${accommodationAddresses.geom}, (SELECT ${cities.boundary} FROM ${cities} WHERE ${cities.id} = ${input.cityId}))`,
        )
        // Prefer the address in the searched city
        addressOrderHint = sql`CASE WHEN ${accommodationAddresses.cityId} = ${input.cityId} THEN 0 ELSE 1 END, ${accommodationAddresses.isMain} DESC`
      } else if (academyId) {
        conditions.push(
          sql`ST_Within(${accommodationAddresses.geom}, (SELECT ${academies.boundary} FROM ${academies} WHERE ${academies.id} = ${academyId}))`,
        )
      } else if (bbox) {
        const parts = bbox.split(',').map(Number)
        if (parts.length === 4) {
          const [xmin, ymin, xmax, ymax] = parts
          conditions.push(sql`ST_Intersects(${accommodationAddresses.geom}, ST_MakeEnvelope(${xmin}, ${ymin}, ${xmax}, ${ymax}, 4326))`)
        }
      } else if (center) {
        applyCenterRadiusFilter(conditions, center, radius)
      }

      const where = and(...conditions)
      return listAccommodationsWithConditions({ page, pageSize, where, addressOrderHint })
    }),

  listExpandedByCity: baseProcedure
    .input(
      z.object({
        city: z.string().min(1),
        radius: z.number().default(EXPANDED_SEARCH_RADIUS_KM),
        page: z.number().default(1),
        pageSize: z.number().default(EXPANDED_SEARCH_PAGE_SIZE),
        isAccessible: z.boolean().optional(),
        hasColiving: z.boolean().optional(),
        onlyWithAvailability: z.boolean().optional(),
        priceMax: z.number().optional(),
        viewCrous: z.boolean().default(false),
        ownerSlug: z.string().optional(),
        excludeIds: z.array(z.number()).optional(),
      }),
    )
    .query(async ({ input }) => {
      const citySlug = input.city.trim().toLowerCase()
      const citySelect = {
        id: cities.id,
        centerLat: sql<number>`ST_Y(ST_Centroid(${cities.boundary})::geometry)`,
        centerLng: sql<number>`ST_X(ST_Centroid(${cities.boundary})::geometry)`,
      }

      // Fast path: lookup by slug (unique index)
      let [cityRow] = await db
        .select(citySelect)
        .from(cities)
        .where(sql`${cities.boundary} IS NOT NULL AND ${cities.slug} = ${citySlug}`)
        .limit(1)

      // Fallback: lookup by normalized name
      if (!cityRow) {
        ;[cityRow] = await db
          .select(citySelect)
          .from(cities)
          .where(
            sql`${cities.boundary} IS NOT NULL AND LOWER(immutable_unaccent(${cities.name})) = LOWER(immutable_unaccent(${input.city.trim()}))`,
          )
          .limit(1)
      }

      if (!cityRow) {
        return {
          count: 0,
          page_size: input.pageSize,
          min_price: null,
          max_price: null,
          next: null,
          previous: null,
          results: { features: [] },
        }
      }

      const { page, pageSize, radius } = input
      const center = `${cityRow.centerLng},${cityRow.centerLat}`

      const conditions: SQL[] = [eq(accommodations.published, true), sql`${accommodationAddresses.geom} IS NOT NULL`]
      await applyCommonListFilters(conditions, input)
      applyCenterRadiusFilter(conditions, center, radius)
      // Exclude accommodations inside the city boundary so only surrounding results appear
      conditions.push(
        sql`NOT ST_Within(${accommodationAddresses.geom}, (SELECT ${cities.boundary} FROM ${cities} WHERE ${cities.id} = ${cityRow.id}))`,
      )
      if (input.excludeIds?.length) {
        conditions.push(notInArray(accommodations.id, input.excludeIds))
      }

      const where = and(...conditions)
      return listAccommodationsWithConditions({ page, pageSize, where })
    }),

  getBySlug: baseProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    // Get the accommodation with its main address
    const rows = await db
      .select({
        id: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        description: accommodations.description,
        address: accommodationAddresses.address,
        city: cities.name,
        postalCode: accommodationAddresses.postalCode,
        residenceType: accommodations.residenceType,
        targetAudience: accommodations.target_audience,
        published: accommodations.published,
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
        acceptWaitingList: accommodations.acceptWaitingList,
        scholarshipHoldersPriority: accommodations.scholarshipHoldersPriority,
        socialHousingRequired: accommodations.socialHousingRequired,
        wifi: accommodations.wifi,
        imagesUrls: accommodations.imagesUrls,
        externalUrl: accommodations.externalUrl,
        virtualTourUrl: accommodations.virtualTourUrl,
        updatedAt: accommodations.updatedAt,
        laundryRoom: accommodations.laundryRoom,
        commonAreas: accommodations.commonAreas,
        bikeStorage: accommodations.bikeStorage,
        parking: accommodations.parking,
        secureAccess: accommodations.secureAccess,
        residenceManager: accommodations.residenceManager,
        kitchenType: accommodations.kitchenType,
        desk: accommodations.desk,
        cookingPlates: accommodations.cookingPlates,
        microwave: accommodations.microwave,
        refrigerator: accommodations.refrigerator,
        bathroom: accommodations.bathroom,
        lat: sql<number>`ST_Y(${accommodationAddresses.geom}::geometry)`,
        lng: sql<number>`ST_X(${accommodationAddresses.geom}::geometry)`,
        ownerName: owners.name,
        ownerSlug: owners.slug,
        ownerUrl: owners.url,
        ownerImage: owners.image,
        ownerAcceptDossierFacile: owners.acceptDossierFacileApplications,
        citySlug: cities.slug,
        cityBbox: bboxSelect(cities),
        departmentCode: departments.code,
      })
      .from(accommodations)
      .innerJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .innerJoin(departments, eq(cities.departmentId, departments.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(and(eq(accommodations.slug, input.slug), eq(accommodations.published, true), sql`${accommodationAddresses.geom} IS NOT NULL`))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `[accommodations.getBySlug] Accommodation not found: ${input.slug}` })
    }

    const allAddresses = await db
      .select({
        address: accommodationAddresses.address,
        postalCode: accommodationAddresses.postalCode,
        cityName: cities.name,
        isMain: accommodationAddresses.isMain,
      })
      .from(accommodationAddresses)
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .where(eq(accommodationAddresses.accommodationId, row.id))
      .orderBy(sql`${accommodationAddresses.isMain} DESC`)

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      address: row.address ?? '',
      city: row.city,
      postal_code: row.postalCode,
      addresses: allAddresses.map((a) => ({
        address: a.address ?? '',
        city: a.cityName,
        postal_code: a.postalCode,
        is_main: a.isMain,
      })),
      residence_type: toResidenceType(row.residenceType),
      target_audience: toTargetAudience(row.targetAudience),
      published: row.published,
      accept_waiting_list: row.acceptWaitingList ?? false,
      images_urls: row.imagesUrls ?? null,
      external_url: row.externalUrl ?? undefined,
      virtual_tour_url: row.virtualTourUrl ?? null,
      updated_at: row.updatedAt ?? new Date(),
      scholarship_holders_priority: row.scholarshipHoldersPriority ?? false,
      social_housing_required: row.socialHousingRequired ?? false,
      wifi: row.wifi ?? false,
      nb_total_apartments: row.nbTotalApartments,
      nb_accessible_apartments: row.nbAccessibleApartments,
      nb_coliving_apartments: row.nbColivingApartments,
      nb_t1: row.nbT1,
      nb_t1_bis: row.nbT1Bis,
      nb_t2: row.nbT2,
      nb_t3: row.nbT3,
      nb_t4: row.nbT4,
      nb_t5: row.nbT5,
      nb_t6: row.nbT6,
      nb_t7_more: row.nbT7More,
      nb_t1_available: row.nbT1Available,
      nb_t1_bis_available: row.nbT1BisAvailable,
      nb_t2_available: row.nbT2Available,
      nb_t3_available: row.nbT3Available,
      nb_t4_available: row.nbT4Available,
      nb_t5_available: row.nbT5Available,
      nb_t6_available: row.nbT6Available,
      nb_t7_more_available: row.nbT7MoreAvailable,
      price_min: row.priceMin,
      price_min_t1: row.priceMinT1,
      price_min_t1_bis: row.priceMinT1Bis,
      price_min_t2: row.priceMinT2,
      price_min_t3: row.priceMinT3,
      price_min_t4: row.priceMinT4,
      price_min_t5: row.priceMinT5,
      price_min_t6: row.priceMinT6,
      price_min_t7_more: row.priceMinT7More,
      price_max: (() => {
        const maxes = [
          row.priceMaxT1,
          row.priceMaxT1Bis,
          row.priceMaxT2,
          row.priceMaxT3,
          row.priceMaxT4,
          row.priceMaxT5,
          row.priceMaxT6,
          row.priceMaxT7More,
        ].filter((v): v is number => v != null && v > 0)
        return maxes.length > 0 ? Math.max(...maxes) : null
      })(),
      price_max_t1: row.priceMaxT1,
      price_max_t1_bis: row.priceMaxT1Bis,
      price_max_t2: row.priceMaxT2,
      price_max_t3: row.priceMaxT3,
      price_max_t4: row.priceMaxT4,
      price_max_t5: row.priceMaxT5,
      price_max_t6: row.priceMaxT6,
      price_max_t7_more: row.priceMaxT7More,
      superficie_min_t1: row.superficieMinT1,
      superficie_max_t1: row.superficieMaxT1,
      superficie_min_t1_bis: row.superficieMinT1Bis,
      superficie_max_t1_bis: row.superficieMaxT1Bis,
      superficie_min_t2: row.superficieMinT2,
      superficie_max_t2: row.superficieMaxT2,
      superficie_min_t3: row.superficieMinT3,
      superficie_max_t3: row.superficieMaxT3,
      superficie_min_t4: row.superficieMinT4,
      superficie_max_t4: row.superficieMaxT4,
      superficie_min_t5: row.superficieMinT5,
      superficie_max_t5: row.superficieMaxT5,
      superficie_min_t6: row.superficieMinT6,
      superficie_max_t6: row.superficieMaxT6,
      superficie_min_t7_more: row.superficieMinT7More,
      superficie_max_t7_more: row.superficieMaxT7More,
      refrigerator: row.refrigerator,
      laundry_room: row.laundryRoom,
      bathroom: row.bathroom as 'private' | 'shared' | null,
      kitchen_type: row.kitchenType as 'private' | 'shared' | null,
      microwave: row.microwave,
      secure_access: row.secureAccess,
      parking: row.parking,
      common_areas: row.commonAreas,
      bike_storage: row.bikeStorage,
      desk: row.desk,
      residence_manager: row.residenceManager,
      cooking_plates: row.cookingPlates,
      geom: {
        type: 'Point' as const,
        coordinates: [row.lng, row.lat],
      },
      owner: row.ownerName
        ? {
            name: row.ownerName,
            slug: row.ownerSlug ?? '',
            url: row.ownerUrl ?? '',
            image_base64: row.ownerImage ? `data:image/jpeg;base64,${Buffer.from(row.ownerImage).toString('base64')}` : null,
            accept_dossier_facile_applications: row.ownerAcceptDossierFacile ?? false,
          }
        : null,
      city_slug: row.citySlug,
      city_bbox: row.cityBbox,
      department_code: row.departmentCode,
    }
  }),
})
