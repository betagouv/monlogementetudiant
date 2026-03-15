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
import { notifyAccommodationCreated, notifyAccommodationUpdated } from '~/server/services/mattermost'
import { computeDerivedFields, generateSlug, geocodeAddress } from '~/server/trpc/utils/accommodation-helpers'
import { AVAILABILITY_FIELD_MAP, mapFields, UPDATE_FIELD_MAP } from '~/server/trpc/utils/field-mapping'
import { findAvailableSlug } from '~/server/utils/slug'
import { createTRPCRouter, ownerProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

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
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })

  const isAdmin = usr?.role === 'admin'

  if (!isAdmin) {
    const owner = usr?.owner ?? null
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

  // Admin: find accommodation without ownership check
  const [accommodation] = await db
    .select({ id: accommodations.id, ownerId: accommodations.ownerId })
    .from(accommodations)
    .where(eq(accommodations.slug, slug))
    .limit(1)

  if (!accommodation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
  }

  // Resolve the accommodation's owner for the return value
  const owner = accommodation.ownerId ? await db.query.owners.findFirst({ where: eq(owners.id, accommodation.ownerId) }) : null

  return { owner: owner ?? usr?.owner ?? null, accommodationId: accommodation.id }
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

export const bailleurRouter = createTRPCRouter({
  list: ownerProcedure
    .input(
      z.object({
        page: z.number().default(1),
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

      const [created] = await db
        .insert(accommodations)
        .values(insertValues)
        .returning({ slug: accommodations.slug, name: accommodations.name })

      notifyAccommodationCreated(created.name, owner.name, created.slug, ctx.session.user.name)

      return { slug: created.slug }
    }),

  update: ownerProcedure.input(z.object({ slug: z.string() }).merge(ZUpdateResidence)).mutation(async ({ ctx, input }) => {
    const { slug, ...fields } = input
    const { owner } = await verifyOwnership(slug, ctx.session.user.id)

    // Snapshot current state for diff
    const [snapshot] = await db.select().from(accommodations).where(eq(accommodations.slug, slug)).limit(1)

    const camelFields = mapFields(fields, UPDATE_FIELD_MAP)

    // Recompute derived fields
    const derived = computeDerivedFields(fields)
    camelFields.nbTotalApartments = derived.nbTotalApartments
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
      .returning({ slug: accommodations.slug, name: accommodations.name })

    if (snapshot) {
      const diff: Record<string, { old: unknown; new: unknown }> = {}
      for (const [key, value] of Object.entries(camelFields)) {
        if (key === 'updatedAt' || key === 'geom') continue
        const oldVal = (snapshot as Record<string, unknown>)[key]
        if (oldVal !== value) {
          diff[key] = { old: oldVal, new: value }
        }
      }
      notifyAccommodationUpdated(updated.name, owner?.name ?? '-', updated.slug, ctx.session.user.name, diff)
    }

    return updated
  }),

  updateAvailability: ownerProcedure.input(z.object({ slug: z.string() }).merge(ZUpdateResidenceList)).mutation(async ({ ctx, input }) => {
    const { slug, ...availFields } = input
    const { owner } = await verifyOwnership(slug, ctx.session.user.id)

    // Snapshot current state for diff
    const [snapshot] = await db.select().from(accommodations).where(eq(accommodations.slug, slug)).limit(1)

    const camelFields = mapFields(availFields, AVAILABILITY_FIELD_MAP)

    const setFields = {
      ...camelFields,
      updatedAt: new Date(),
    }

    const [updated] = await db
      .update(accommodations)
      .set(setFields)
      .where(eq(accommodations.slug, slug))
      .returning({ slug: accommodations.slug, name: accommodations.name })

    if (snapshot) {
      const diff: Record<string, { old: unknown; new: unknown }> = {}
      for (const [key, value] of Object.entries(setFields)) {
        if (key === 'updatedAt') continue
        const oldVal = (snapshot as Record<string, unknown>)[key]
        if (oldVal !== value) {
          diff[key] = { old: oldVal, new: value }
        }
      }
      notifyAccommodationUpdated(updated.name, owner?.name ?? '-', updated.slug, ctx.session.user.name, diff)
    }

    return updated
  }),
})
