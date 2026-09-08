import { TRPCError } from '@trpc/server'
import { and, eq, notInArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import type { TAccomodation } from '~/schemas/accommodations/accommodations'
import {
  applyCenterRadiusFilter,
  applyCommonListFilters,
  crousExistsCondition,
  listAccommodationsWithConditions,
  toResidenceType,
  toTargetAudience,
} from '~/server/accommodations/list-query'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { owners } from '~/server/db/schema/owners'
import { typologiesByType } from '~/server/lib/typologies'
import { baseProcedure, createTRPCRouter } from '../init'
import { bboxSelect } from '../utils/spatial-helpers'

// Les query builders vivent désormais dans `~/server/accommodations/list-query` (partagés avec l'API
// publique REST v1). On ré-exporte les symboles encore importés directement depuis ce module par
// d'autres routers (favorites, bailleur) et par `get-my-accommodations`.
export { priceMaxComputed, rowsToAccommodationDTOs, toAccommodationDTO } from '~/server/accommodations/list-query'

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
        departmentId: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { bbox, center, radius, page, pageSize, academyId, departmentId } = input

      const conditions: SQL[] = [eq(accommodations.published, true), sql`${accommodationAddresses.geom} IS NOT NULL`]
      // On applique tous les filtres SAUF crous : les conditions résultantes servent à compter les deux buckets,
      // puis on ajoute le filtre crous par-dessus pour les résultats paginés.
      await applyCommonListFilters(conditions, { ...input, skipCrous: true })

      let addressOrderHint: SQL | undefined
      if (input.cityId) {
        conditions.push(
          sql`ST_Within(${accommodationAddresses.geom}, (SELECT ${cities.boundary} FROM ${cities} WHERE ${cities.id} = ${input.cityId}))`,
        )
        // Prefer the address in the searched city
        addressOrderHint = sql`CASE WHEN ${accommodationAddresses.cityId} = ${input.cityId} THEN 0 ELSE 1 END, ${accommodationAddresses.isMain} DESC`
      } else if (departmentId) {
        // Filtre sur la frontière réelle du département : une bbox laisserait passer les résidences
        // des départements voisins qui tombent dans le rectangle englobant (ex. Belfort dans le Haut-Rhin).
        conditions.push(
          sql`ST_Within(${accommodationAddresses.geom}, (SELECT ${departments.boundary} FROM ${departments} WHERE ${departments.id} = ${departmentId}))`,
        )
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

      const whereWithoutCrous = and(...conditions)
      const where = and(whereWithoutCrous, input.viewCrous ? crousExistsCondition : sql`NOT (${crousExistsCondition})`)
      return listAccommodationsWithConditions({ page, pageSize, where, whereWithoutCrous, addressOrderHint })
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
          pageSize: input.pageSize,
          minPrice: null,
          maxPrice: null,
          next: null,
          previous: null,
          results: [] as TAccomodation[],
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
        rentalChargesDetails: accommodations.rentalChargesDetails,
        address: accommodationAddresses.address,
        city: cities.name,
        postalCode: accommodationAddresses.postalCode,
        residenceType: accommodations.residenceType,
        targetAudience: accommodations.targetAudience,
        published: accommodations.published,
        nbTotalApartments: accommodations.nbTotalApartments,
        nbAccessibleApartments: accommodations.nbAccessibleApartments,
        nbColivingApartments: accommodations.nbColivingApartments,
        priceMin: accommodations.priceMin,
        priceMax: accommodations.priceMax,
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
        ownerLandingUrl: owners.landingUrl,
        ownerImage: owners.image,
        ownerContactMode: owners.contactMode,
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

    const typologyRows = await db.select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, row.id))
    const typologies = typologiesByType(typologyRows)

    const allAddresses = await db
      .select({
        address: accommodationAddresses.address,
        postalCode: accommodationAddresses.postalCode,
        cityName: cities.name,
        isMain: accommodationAddresses.isMain,
        lat: sql<number | null>`ST_Y(${accommodationAddresses.geom}::geometry)`,
        lng: sql<number | null>`ST_X(${accommodationAddresses.geom}::geometry)`,
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
      rentalChargesDetails: row.rentalChargesDetails ?? null,
      address: row.address ?? '',
      city: row.city,
      postalCode: row.postalCode,
      addresses: allAddresses.map((a) => ({
        address: a.address ?? '',
        city: a.cityName,
        postalCode: a.postalCode,
        isMain: a.isMain,
        latitude: a.lat,
        longitude: a.lng,
      })),
      residenceType: toResidenceType(row.residenceType),
      targetAudience: toTargetAudience(row.targetAudience),
      published: row.published,
      acceptWaitingList: row.acceptWaitingList ?? false,
      imagesUrls: row.imagesUrls ?? null,
      externalUrl: row.externalUrl ?? undefined,
      virtualTourUrl: row.virtualTourUrl ?? null,
      updatedAt: row.updatedAt ?? new Date(),
      scholarshipHoldersPriority: row.scholarshipHoldersPriority ?? false,
      socialHousingRequired: row.socialHousingRequired ?? false,
      wifi: row.wifi ?? false,
      latitude: row.lat ?? null,
      longitude: row.lng ?? null,
      nbTotalApartments: row.nbTotalApartments,
      nbAccessibleApartments: row.nbAccessibleApartments,
      nbColivingApartments: row.nbColivingApartments,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      ownerName: row.ownerName ?? null,
      ownerUrl: row.ownerUrl ?? null,
      typologies,
      refrigerator: row.refrigerator,
      laundryRoom: row.laundryRoom,
      bathroom: row.bathroom as 'private' | 'shared' | null,
      kitchenType: row.kitchenType as 'private' | 'shared' | null,
      microwave: row.microwave,
      secureAccess: row.secureAccess,
      parking: row.parking,
      commonAreas: row.commonAreas,
      bikeStorage: row.bikeStorage,
      desk: row.desk,
      residenceManager: row.residenceManager,
      cookingPlates: row.cookingPlates,
      owner: row.ownerName
        ? {
            name: row.ownerName,
            slug: row.ownerSlug ?? '',
            url: row.ownerUrl ?? '',
            landingUrl: row.ownerLandingUrl ?? null,
            imageBase64: row.ownerImage ? `data:image/jpeg;base64,${Buffer.from(row.ownerImage).toString('base64')}` : null,
            contactMode: row.ownerContactMode ?? EOwnerContactMode.NONE,
          }
        : null,
      citySlug: row.citySlug,
      cityBbox: row.cityBbox,
      departmentCode: row.departmentCode,
    }
  }),
})
