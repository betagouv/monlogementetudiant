import { TRPCError } from '@trpc/server'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import { transformTypologiesToFlat, ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { ZUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { computeDerivedFields, generateSlug, geocodeAddress } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'
import { createTRPCRouter, ownerProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

// --- snake_case input → camelCase DB helpers ---

function snakeToCamelAvailability(input: z.infer<typeof ZUpdateResidenceList>) {
  return {
    nbT1Available: input.nb_t1_available,
    nbT1BisAvailable: input.nb_t1_bis_available,
    nbT2Available: input.nb_t2_available,
    nbT3Available: input.nb_t3_available,
    nbT4Available: input.nb_t4_available,
    nbT5Available: input.nb_t5_available,
    nbT6Available: input.nb_t6_available,
    nbT7MoreAvailable: input.nb_t7_more_available,
  }
}

function snakeToCamelUpdate(input: z.infer<typeof ZUpdateResidence>) {
  const result: Record<string, unknown> = {}

  if (input.name !== undefined) result.name = input.name
  if (input.residence_type !== undefined) result.residenceType = input.residence_type
  if (input.target_audience !== undefined) result.target_audience = input.target_audience
  if (input.address !== undefined) result.address = input.address
  if (input.city !== undefined) result.city = input.city
  if (input.postal_code !== undefined) result.postalCode = input.postal_code
  if (input.description !== undefined) result.description = input.description
  if (input.external_url !== undefined) result.externalUrl = input.external_url
  if (input.accept_waiting_list !== undefined) result.acceptWaitingList = input.accept_waiting_list
  if (input.published !== undefined) result.published = input.published
  if (input.scholarship_holders_priority !== undefined) result.scholarshipHoldersPriority = input.scholarship_holders_priority
  if (input.images_urls !== undefined) result.imagesUrls = input.images_urls

  // Typology fields
  if (input.nb_t1 !== undefined) result.nbT1 = input.nb_t1
  if (input.nb_t1_available !== undefined) result.nbT1Available = input.nb_t1_available
  if (input.price_min_t1 !== undefined) result.priceMinT1 = input.price_min_t1
  if (input.price_max_t1 !== undefined) result.priceMaxT1 = input.price_max_t1

  if (input.nb_t1_bis !== undefined) result.nbT1Bis = input.nb_t1_bis
  if (input.nb_t1_bis_available !== undefined) result.nbT1BisAvailable = input.nb_t1_bis_available
  if (input.price_min_t1_bis !== undefined) result.priceMinT1Bis = input.price_min_t1_bis
  if (input.price_max_t1_bis !== undefined) result.priceMaxT1Bis = input.price_max_t1_bis

  if (input.nb_t2 !== undefined) result.nbT2 = input.nb_t2
  if (input.nb_t2_available !== undefined) result.nbT2Available = input.nb_t2_available
  if (input.price_min_t2 !== undefined) result.priceMinT2 = input.price_min_t2
  if (input.price_max_t2 !== undefined) result.priceMaxT2 = input.price_max_t2

  if (input.nb_t3 !== undefined) result.nbT3 = input.nb_t3
  if (input.nb_t3_available !== undefined) result.nbT3Available = input.nb_t3_available
  if (input.price_min_t3 !== undefined) result.priceMinT3 = input.price_min_t3
  if (input.price_max_t3 !== undefined) result.priceMaxT3 = input.price_max_t3

  if (input.nb_t4 !== undefined) result.nbT4 = input.nb_t4
  if (input.nb_t4_available !== undefined) result.nbT4Available = input.nb_t4_available
  if (input.price_min_t4 !== undefined) result.priceMinT4 = input.price_min_t4
  if (input.price_max_t4 !== undefined) result.priceMaxT4 = input.price_max_t4

  if (input.nb_t5 !== undefined) result.nbT5 = input.nb_t5
  if (input.nb_t5_available !== undefined) result.nbT5Available = input.nb_t5_available
  if (input.price_min_t5 !== undefined) result.priceMinT5 = input.price_min_t5
  if (input.price_max_t5 !== undefined) result.priceMaxT5 = input.price_max_t5

  if (input.nb_t6 !== undefined) result.nbT6 = input.nb_t6
  if (input.nb_t6_available !== undefined) result.nbT6Available = input.nb_t6_available
  if (input.price_min_t6 !== undefined) result.priceMinT6 = input.price_min_t6
  if (input.price_max_t6 !== undefined) result.priceMaxT6 = input.price_max_t6

  if (input.nb_t7_more !== undefined) result.nbT7More = input.nb_t7_more
  if (input.nb_t7_more_available !== undefined) result.nbT7MoreAvailable = input.nb_t7_more_available
  if (input.price_min_t7_more !== undefined) result.priceMinT7More = input.price_min_t7_more
  if (input.price_max_t7_more !== undefined) result.priceMaxT7More = input.price_max_t7_more

  if (input.nb_accessible_apartments !== undefined) result.nbAccessibleApartments = input.nb_accessible_apartments
  if (input.nb_coliving_apartments !== undefined) result.nbColivingApartments = input.nb_coliving_apartments

  // Amenities
  if (input.refrigerator !== undefined) result.refrigerator = input.refrigerator
  if (input.laundry_room !== undefined) result.laundryRoom = input.laundry_room
  if (input.bathroom !== undefined) result.bathroom = input.bathroom
  if (input.kitchen_type !== undefined) result.kitchenType = input.kitchen_type
  if (input.microwave !== undefined) result.microwave = input.microwave
  if (input.secure_access !== undefined) result.secureAccess = input.secure_access
  if (input.parking !== undefined) result.parking = input.parking
  if (input.common_areas !== undefined) result.commonAreas = input.common_areas
  if (input.bike_storage !== undefined) result.bikeStorage = input.bike_storage
  if (input.desk !== undefined) result.desk = input.desk
  if (input.residence_manager !== undefined) result.residenceManager = input.residence_manager
  if (input.cooking_plates !== undefined) result.cookingPlates = input.cooking_plates

  return result
}

async function getOrCreateOwner(userId: string, userName: string) {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })
  if (usr?.owner) return usr.owner

  const [created] = await db
    .insert(owners)
    .values({
      name: userName,
      slug: await findAvailableSlug(generateSlug(userName), db, owners),
    })
    .returning()

  await db.update(user).set({ ownerId: created.id }).where(eq(user.id, userId))

  return created
}

async function getOwnerForUser(userId: string) {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })
  return usr?.owner ?? null
}

async function verifyOwnership(slug: string, userId: string) {
  const owner = await getOwnerForUser(userId)
  if (!owner) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No owner record for this user' })
  }

  const [accommodation] = await db
    .select({ id: accommodations.id })
    .from(accommodations)
    .where(and(eq(accommodations.slug, slug), eq(accommodations.ownerId, owner.id)))
    .limit(1)

  if (!accommodation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found or not owned by you' })
  }

  return { owner, accommodationId: accommodation.id }
}

// Build GeoJSON Feature for "my" accommodation (includes amenities)
function mapToMyGeoJsonFeature(row: Record<string, unknown>) {
  const base = mapToGeoJsonFeature(row)
  return {
    geometry: base.geometry,
    properties: {
      ...base.properties,
      refrigerator: (row.refrigerator as boolean) ?? null,
      laundry_room: (row.laundryRoom as boolean) ?? null,
      bathroom: (row.bathroom as string) ?? null,
      kitchen_type: (row.kitchenType as string) ?? null,
      microwave: (row.microwave as boolean) ?? null,
      secure_access: (row.secureAccess as boolean) ?? null,
      parking: (row.parking as boolean) ?? null,
      common_areas: (row.commonAreas as boolean) ?? null,
      bike_storage: (row.bikeStorage as boolean) ?? null,
      desk: (row.desk as boolean) ?? null,
      residence_manager: (row.residenceManager as boolean) ?? null,
      cooking_plates: (row.cookingPlates as boolean) ?? null,
    },
  }
}

const PAGE_SIZE = 20

const accommodationSelectFields = {
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
} as const

const accommodationSelectFieldsWithAmenities = {
  ...accommodationSelectFields,
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
} as const

export const bailleurRouter = createTRPCRouter({
  list: ownerProcedure
    .input(
      z.object({
        page: z.number().default(1),
        hasAvailability: z.boolean().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const owner = await getOwnerForUser(userId)

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

      const conditions = [eq(accommodations.ownerId, owner.id)]

      if (input.hasAvailability === true) {
        conditions.push(eq(accommodations.available, true))
      } else if (input.hasAvailability === false) {
        conditions.push(eq(accommodations.available, false))
      }

      if (input.search && input.search.length >= 3) {
        conditions.push(ilike(accommodations.name, `%${input.search}%`))
      }

      const where = and(...conditions)
      const offset = (input.page - 1) * PAGE_SIZE

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
          .select(accommodationSelectFields)
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
        next: input.page < totalPages ? String(input.page + 1) : null,
        previous: input.page > 1 ? String(input.page - 1) : null,
        min_price: priceBounds[0]?.minPrice != null ? Number(priceBounds[0].minPrice) : null,
        max_price: priceBounds[0]?.maxPrice != null ? Number(priceBounds[0].maxPrice) : null,
        results: {
          features: results.map(mapToGeoJsonFeature),
        },
      }
    }),

  getBySlug: ownerProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const owner = await getOwnerForUser(userId)

    if (!owner) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
    }

    const rows = await db
      .select(accommodationSelectFieldsWithAmenities)
      .from(accommodations)
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(and(eq(accommodations.slug, input.slug), eq(accommodations.ownerId, owner.id)))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found or not owned by you' })
    }

    return mapToMyGeoJsonFeature(row as Record<string, unknown>)
  }),

  create: ownerProcedure
    .input(
      ZCreateResidence.omit({ images_files: true }).extend({
        name: z.string().min(1, 'Le nom de la résidence est requis'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const owner = await getOrCreateOwner(userId, ctx.session.user.name)

      const { typologies, ...fields } = input
      const flatTypologies = transformTypologiesToFlat(typologies)

      const slug = await findAvailableSlug(generateSlug(fields.name), db, accommodations)

      // Geocode address
      const coords = await geocodeAddress(fields.address, fields.city, fields.postal_code)

      // Compute derived fields from flat typologies
      const derived = computeDerivedFields({ ...flatTypologies })

      const insertValues: typeof accommodations.$inferInsert = {
        name: fields.name,
        slug,
        address: fields.address,
        city: fields.city,
        postalCode: fields.postal_code,
        residenceType: fields.residence_type ?? null,
        target_audience: fields.target_audience ?? null,
        description: fields.description ?? null,
        externalUrl: fields.external_url || null,
        acceptWaitingList: fields.accept_waiting_list ?? false,
        published: fields.published ?? false,
        scholarshipHoldersPriority: fields.scholarship_holders_priority ?? false,
        ownerId: owner.id,
        available: derived.available,
        nbTotalApartments: derived.nbTotalApartments,
        priceMin: derived.priceMin,
        imagesCount: derived.imagesCount,
        imagesUrls: [],
        // Typology counts
        nbT1: flatTypologies.nb_t1 as number | null,
        nbT1Bis: flatTypologies.nb_t1_bis as number | null,
        nbT2: flatTypologies.nb_t2 as number | null,
        nbT3: flatTypologies.nb_t3 as number | null,
        nbT4: flatTypologies.nb_t4 as number | null,
        nbT5: flatTypologies.nb_t5 as number | null,
        nbT6: flatTypologies.nb_t6 as number | null,
        nbT7More: flatTypologies.nb_t7_more as number | null,
        // Availability
        nbT1Available: flatTypologies.nb_t1_available as number | null,
        nbT1BisAvailable: flatTypologies.nb_t1_bis_available as number | null,
        nbT2Available: flatTypologies.nb_t2_available as number | null,
        nbT3Available: flatTypologies.nb_t3_available as number | null,
        nbT4Available: flatTypologies.nb_t4_available as number | null,
        nbT5Available: flatTypologies.nb_t5_available as number | null,
        nbT6Available: flatTypologies.nb_t6_available as number | null,
        nbT7MoreAvailable: flatTypologies.nb_t7_more_available as number | null,
        // Pricing
        priceMinT1: flatTypologies.price_min_t1 as number | null,
        priceMaxT1: flatTypologies.price_max_t1 as number | null,
        priceMinT1Bis: flatTypologies.price_min_t1_bis as number | null,
        priceMaxT1Bis: flatTypologies.price_max_t1_bis as number | null,
        priceMinT2: flatTypologies.price_min_t2 as number | null,
        priceMaxT2: flatTypologies.price_max_t2 as number | null,
        priceMinT3: flatTypologies.price_min_t3 as number | null,
        priceMaxT3: flatTypologies.price_max_t3 as number | null,
        priceMinT4: flatTypologies.price_min_t4 as number | null,
        priceMaxT4: flatTypologies.price_max_t4 as number | null,
        priceMinT5: flatTypologies.price_min_t5 as number | null,
        priceMaxT5: flatTypologies.price_max_t5 as number | null,
        priceMinT6: flatTypologies.price_min_t6 as number | null,
        priceMaxT6: flatTypologies.price_max_t6 as number | null,
        priceMinT7More: flatTypologies.price_min_t7_more as number | null,
        priceMaxT7More: flatTypologies.price_max_t7_more as number | null,
        // Amenities (defaults)
        nbAccessibleApartments: 0,
        nbColivingApartments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      if (coords) {
        ;(insertValues as Record<string, unknown>).geom = sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)`
      }

      const [created] = await db.insert(accommodations).values(insertValues).returning({ slug: accommodations.slug })

      return { slug: created.slug }
    }),

  update: ownerProcedure.input(z.object({ slug: z.string() }).merge(ZUpdateResidence)).mutation(async ({ ctx, input }) => {
    const { slug, ...fields } = input
    await verifyOwnership(slug, ctx.session.user.id)

    const camelFields = snakeToCamelUpdate(fields)

    // Recompute derived fields
    const derived = computeDerivedFields(fields)
    camelFields.nbTotalApartments = derived.nbTotalApartments
    camelFields.available = derived.available
    camelFields.priceMin = derived.priceMin
    camelFields.imagesCount = derived.imagesCount

    // Re-geocode if address changed
    if (fields.address !== undefined || fields.city !== undefined || fields.postal_code !== undefined) {
      // Fetch current values to fill in blanks
      const [current] = await db
        .select({ address: accommodations.address, city: accommodations.city, postalCode: accommodations.postalCode })
        .from(accommodations)
        .where(eq(accommodations.slug, slug))
        .limit(1)

      if (current) {
        const address = fields.address ?? current.address ?? ''
        const city = fields.city ?? current.city
        const postalCode = fields.postal_code ?? current.postalCode
        const coords = await geocodeAddress(address, city, postalCode)
        if (coords) {
          camelFields.geom = sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)`
        }
      }
    }

    camelFields.updatedAt = new Date()

    const [updated] = await db
      .update(accommodations)
      .set(camelFields)
      .where(eq(accommodations.slug, slug))
      .returning({ slug: accommodations.slug })

    return updated
  }),

  updateAvailability: ownerProcedure.input(z.object({ slug: z.string() }).merge(ZUpdateResidenceList)).mutation(async ({ ctx, input }) => {
    const { slug, ...availFields } = input
    await verifyOwnership(slug, ctx.session.user.id)

    const camelFields = snakeToCamelAvailability(availFields)

    // Recompute available flag
    const available = Object.values(camelFields).some((v) => v != null && (v as number) > 0)

    const [updated] = await db
      .update(accommodations)
      .set({
        ...camelFields,
        available,
        updatedAt: new Date(),
      })
      .where(eq(accommodations.slug, slug))
      .returning({ slug: accommodations.slug })

    return updated
  }),
})
