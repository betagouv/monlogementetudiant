import { TRPCError } from '@trpc/server'
import { and, asc, count, desc, eq, gt, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { headers } from 'next/headers'
import { z } from 'zod'
import { transformTypologiesToFlat, ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { ZUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import { zCreateBailleurUser, zUpdateBailleurUser } from '~/schemas/bailleur-users/bailleur-user-form'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { ADMIN_ONLY_PERMISSIONS, canGrantAdministratorRights } from '~/server/bailleur/permissions'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { dossierFacileApplications, dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { owners } from '~/server/db/schema/owners'
import { classifyActions, computeDiff } from '~/server/services/accommodation-diff'
import { logActivity } from '~/server/services/activity-logger'
import { notifyAccommodationCreated, notifyAccommodationUpdated } from '~/server/services/mattermost'
import { computeDerivedFields, generateSlug, geocodeAddress } from '~/server/trpc/utils/accommodation-helpers'
import { AVAILABILITY_FIELD_MAP, mapFields, UPDATE_FIELD_MAP } from '~/server/trpc/utils/field-mapping'
import { resolveCityId } from '~/server/trpc/utils/resolve-city'
import { getJwtSecret } from '~/server/utils/jwt-secret'
import { findAvailableSlug } from '~/server/utils/slug'
import { auth } from '~/services/better-auth'
import { normalizeAccommodationName } from '~/utils/normalize-accommodation-name'
import { bailleurProcedure, createTRPCRouter, ownerProcedure } from '../init'
import { mapToGeoJsonFeature, priceMaxComputed } from './accommodations'

async function verifyOwnerAccess(userId: string, accommodationSlug: string) {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })
  const isAdmin = usr?.role === 'admin'

  const [accommodation] = await db
    .select({ ownerId: accommodations.ownerId })
    .from(accommodations)
    .where(eq(accommodations.slug, accommodationSlug))
    .limit(1)

  if (!accommodation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
  if (!isAdmin && (!usr?.owner || accommodation.ownerId !== usr.owner.id)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this accommodation' })
  }
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

const TYPOLOGY_COUNT_FIELDS = ['nb_t1', 'nb_t1_bis', 'nb_t2', 'nb_t3', 'nb_t4', 'nb_t5', 'nb_t6', 'nb_t7_more'] as const
const PRICE_MIN_FIELDS = [
  'price_min_t1',
  'price_min_t1_bis',
  'price_min_t2',
  'price_min_t3',
  'price_min_t4',
  'price_min_t5',
  'price_min_t6',
  'price_min_t7_more',
] as const

function hasOwnField<T extends string>(fields: Record<string, unknown>, key: T) {
  return Object.hasOwn(fields, key)
}

const accommodationSelectFields = {
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
  priceMaxComputed,
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
} as const

export const bailleurRouter = createTRPCRouter({
  list: ownerProcedure
    .input(
      z.object({
        page: z.number().default(1),
        search: z.string().optional(),
        hasAvailability: z.boolean().optional(),
        ownerId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const owner = await getOwnerForUser(userId, input.ownerId)

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
        // Search joins through addresses to match city name
        conditions.push(or(ilike(accommodations.name, `%${input.search}%`), ilike(cities.name, `%${input.search}%`))!)
      }

      if (input.hasAvailability) {
        conditions.push(
          or(
            gt(accommodations.nbT1Available, 0),
            gt(accommodations.nbT1BisAvailable, 0),
            gt(accommodations.nbT2Available, 0),
            gt(accommodations.nbT3Available, 0),
            gt(accommodations.nbT4Available, 0),
            gt(accommodations.nbT5Available, 0),
            gt(accommodations.nbT6Available, 0),
            gt(accommodations.nbT7MoreAvailable, 0),
          )!,
        )
      }

      const where = and(...conditions)
      const offset = (input.page - 1) * PAGE_SIZE

      const [countResult, priceBounds, results] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(accommodations)
          .innerJoin(
            accommodationAddresses,
            and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
          )
          .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
          .where(where),
        db
          .select({
            minPrice: sql<number | null>`MIN(${accommodations.priceMin})`,
            maxPrice: sql<number | null>`MAX(${priceMaxComputed})`,
          })
          .from(accommodations)
          .innerJoin(
            accommodationAddresses,
            and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
          )
          .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
          .where(where),
        db
          .select(accommodationSelectFields)
          .from(accommodations)
          .innerJoin(
            accommodationAddresses,
            and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
          )
          .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
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
  create: bailleurProcedure('manage_residences')
    .input(
      ZCreateResidence.omit({ images_files: true }).extend({
        name: z.string().min(1, 'Le nom de la résidence est requis'),
        ownerId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const owner = await getOwnerForUser(userId, input.ownerId)
      if (!owner) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No owner record for this user' })
      }

      const { typologies, name, addresses, ...fields } = input
      const flatTypologies = transformTypologiesToFlat(typologies)

      const slug = await findAvailableSlug(generateSlug(name), db, accommodations)

      // Compute derived fields from flat typologies
      const derived = computeDerivedFields({ ...flatTypologies })

      const insertValues: typeof accommodations.$inferInsert = {
        name: normalizeAccommodationName(name),
        slug,
        residenceType: fields.residence_type ?? null,
        target_audience: fields.target_audience ?? null,
        description: fields.description ?? null,
        externalUrl: fields.external_url || null,
        acceptWaitingList: fields.accept_waiting_list ?? false,
        published: fields.published ?? false,
        scholarshipHoldersPriority: fields.scholarship_holders_priority ?? false,
        socialHousingRequired: fields.social_housing_required ?? false,
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
        // Superficie
        superficieMinT1: flatTypologies.superficie_min_t1 as number | null,
        superficieMaxT1: flatTypologies.superficie_max_t1 as number | null,
        superficieMinT1Bis: flatTypologies.superficie_min_t1_bis as number | null,
        superficieMaxT1Bis: flatTypologies.superficie_max_t1_bis as number | null,
        superficieMinT2: flatTypologies.superficie_min_t2 as number | null,
        superficieMaxT2: flatTypologies.superficie_max_t2 as number | null,
        superficieMinT3: flatTypologies.superficie_min_t3 as number | null,
        superficieMaxT3: flatTypologies.superficie_max_t3 as number | null,
        superficieMinT4: flatTypologies.superficie_min_t4 as number | null,
        superficieMaxT4: flatTypologies.superficie_max_t4 as number | null,
        superficieMinT5: flatTypologies.superficie_min_t5 as number | null,
        superficieMaxT5: flatTypologies.superficie_max_t5 as number | null,
        superficieMinT6: flatTypologies.superficie_min_t6 as number | null,
        superficieMaxT6: flatTypologies.superficie_max_t6 as number | null,
        superficieMinT7More: flatTypologies.superficie_min_t7_more as number | null,
        superficieMaxT7More: flatTypologies.superficie_max_t7_more as number | null,
        // Amenities (defaults)
        nbAccessibleApartments: 0,
        nbColivingApartments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const [created] = await db
        .insert(accommodations)
        .values(insertValues)
        .returning({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name })

      // Geocode + resolve cities in parallel, then batch insert
      const resolved = await Promise.all(
        addresses.map(async (addr, i) => {
          const [coords, cityId] = await Promise.all([
            geocodeAddress(addr.address, addr.city, addr.postal_code),
            resolveCityId(addr.postal_code, addr.city),
          ])
          const values: typeof accommodationAddresses.$inferInsert = {
            accommodationId: created.id,
            isMain: i === 0,
            address: addr.address,
            postalCode: addr.postal_code,
            cityId,
          }
          if (coords) {
            ;(values as Record<string, unknown>).geom = sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)`
          }
          return values
        }),
      )
      await db.insert(accommodationAddresses).values(resolved)

      notifyAccommodationCreated(created.name, owner.name, created.slug, ctx.session.user.name)
      await logActivity({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        action: 'accommodation.created',
        entityType: 'accommodation',
        entityName: created.name,
        ownerId: owner.id,
        ownerName: owner.name,
        metadata: { slug: created.slug },
      })

      return { slug: created.slug }
    }),

  update: bailleurProcedure('manage_residences')
    .input(z.object({ slug: z.string() }).merge(ZUpdateResidence))
    .mutation(async ({ ctx, input }) => {
      const { slug, addresses: inputAddresses, ...fields } = input
      const { owner, accommodationId } = await verifyOwnership(slug, ctx.session.user.id)

      // Snapshot current state for diff
      const [snapshot] = await db.select().from(accommodations).where(eq(accommodations.slug, slug)).limit(1)

      const camelFields = mapFields(fields, UPDATE_FIELD_MAP)
      if (typeof camelFields.name === 'string') {
        camelFields.name = normalizeAccommodationName(camelFields.name)
      }
      const userProvidedKeys = new Set(Object.keys(camelFields))

      const hasTypologyCountUpdate = TYPOLOGY_COUNT_FIELDS.some((key) => hasOwnField(fields, key))
      const hasPriceMinUpdate = PRICE_MIN_FIELDS.some((key) => hasOwnField(fields, key))
      const hasImagesUpdate = hasOwnField(fields, 'images_urls')

      if (hasTypologyCountUpdate) {
        const derived = computeDerivedFields(fields)
        camelFields.nbTotalApartments = derived.nbTotalApartments ?? snapshot?.nbTotalApartments ?? null
      }
      if (hasPriceMinUpdate) {
        const currentPrices = {
          price_min_t1: snapshot?.priceMinT1,
          price_min_t1_bis: snapshot?.priceMinT1Bis,
          price_min_t2: snapshot?.priceMinT2,
          price_min_t3: snapshot?.priceMinT3,
          price_min_t4: snapshot?.priceMinT4,
          price_min_t5: snapshot?.priceMinT5,
          price_min_t6: snapshot?.priceMinT6,
          price_min_t7_more: snapshot?.priceMinT7More,
        }
        const derived = computeDerivedFields({ ...currentPrices, ...fields })
        camelFields.priceMin = derived.priceMin
      }
      if (hasImagesUpdate) {
        const derived = computeDerivedFields(fields)
        camelFields.imagesCount = derived.imagesCount
      }

      // Handle addresses update
      if (inputAddresses !== undefined) {
        // Geocode in parallel, then delete old + batch insert
        const resolved = await Promise.all(
          inputAddresses.map(async (addr, i) => {
            const [coords, cityId] = await Promise.all([
              geocodeAddress(addr.address, addr.city, addr.postal_code),
              resolveCityId(addr.postal_code, addr.city),
            ])
            const values: typeof accommodationAddresses.$inferInsert = {
              accommodationId,
              isMain: i === 0,
              address: addr.address,
              postalCode: addr.postal_code,
              cityId,
            }
            if (coords) {
              ;(values as Record<string, unknown>).geom = sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)`
            }
            return values
          }),
        )
        await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodationId))
        await db.insert(accommodationAddresses).values(resolved)
      }

      camelFields.updatedAt = new Date()

      const [updated] = await db
        .update(accommodations)
        .set(camelFields)
        .where(eq(accommodations.slug, slug))
        .returning({ slug: accommodations.slug, name: accommodations.name })

      if (snapshot) {
        const diff = computeDiff(snapshot as Record<string, unknown>, camelFields, userProvidedKeys)
        notifyAccommodationUpdated(updated.name, owner?.name ?? '-', updated.slug, ctx.session.user.name, diff)
        for (const { action, diff: actionDiff } of classifyActions(diff)) {
          await logActivity({
            userId: ctx.session.user.id,
            userName: ctx.session.user.name,
            action,
            entityType: 'accommodation',
            entityName: updated.name,
            ownerId: owner?.id,
            ownerName: owner?.name,
            metadata: { slug: updated.slug, diff: actionDiff },
          })
        }
      }

      return updated
    }),

  updateAvailability: bailleurProcedure('manage_availability')
    .input(z.object({ slug: z.string() }).merge(ZUpdateResidenceList))
    .mutation(async ({ ctx, input }) => {
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
        const userKeys = new Set(Object.keys(camelFields))
        const diff = computeDiff(snapshot as Record<string, unknown>, setFields, userKeys)
        notifyAccommodationUpdated(updated.name, owner?.name ?? '-', updated.slug, ctx.session.user.name, diff)
        for (const { action, diff: actionDiff } of classifyActions(diff)) {
          await logActivity({
            userId: ctx.session.user.id,
            userName: ctx.session.user.name,
            action,
            entityType: 'accommodation',
            entityName: updated.name,
            ownerId: owner?.id,
            ownerName: owner?.name,
            metadata: { slug: updated.slug, diff: actionDiff },
          })
        }
      }

      return updated
    }),

  listCandidatures: bailleurProcedure('manage_applications')
    .input(
      z.object({
        page: z.number().default(1),
        status: z.enum(['pending', 'accepted', 'rejected']).optional(),
        search: z.string().optional(),
        sort: z.enum(['date_desc', 'date_asc']).default('date_desc'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const owner = await getOwnerForUser(ctx.session.user.id)

      if (!owner) {
        return { items: [], total: 0, page: input.page, pageSize: PAGE_SIZE }
      }

      const ownerAccommodations = await db
        .select({ slug: accommodations.slug })
        .from(accommodations)
        .where(eq(accommodations.ownerId, owner.id))

      const slugs = ownerAccommodations.map((a) => a.slug)

      if (slugs.length === 0) {
        return { items: [], total: 0, page: input.page, pageSize: PAGE_SIZE }
      }

      const conditions = [inArray(dossierFacileApplications.accommodationSlug, slugs)]

      if (input.status) {
        conditions.push(eq(dossierFacileApplications.status, input.status))
      }

      if (input.search && input.search.length >= 2) {
        conditions.push(or(ilike(user.name, `%${input.search}%`), ilike(accommodations.name, `%${input.search}%`))!)
      }

      const where = and(...conditions)
      const offset = (input.page - 1) * PAGE_SIZE
      const orderBy = input.sort === 'date_asc' ? asc(dossierFacileApplications.createdAt) : desc(dossierFacileApplications.createdAt)

      const [countResult, results] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(dossierFacileApplications)
          .leftJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
          .leftJoin(user, eq(dossierFacileTenants.userId, user.id))
          .leftJoin(accommodations, eq(dossierFacileApplications.accommodationSlug, accommodations.slug))
          .where(where),
        db
          .select({
            id: dossierFacileApplications.id,
            studentName: user.name,
            studentEmail: user.email,
            residence: accommodations.name,
            apartmentType: dossierFacileApplications.apartmentType,
            status: dossierFacileApplications.status,
            createdAt: dossierFacileApplications.createdAt,
            accommodationSlug: dossierFacileApplications.accommodationSlug,
          })
          .from(dossierFacileApplications)
          .leftJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
          .leftJoin(user, eq(dossierFacileTenants.userId, user.id))
          .leftJoin(accommodations, eq(dossierFacileApplications.accommodationSlug, accommodations.slug))
          .where(where)
          .orderBy(orderBy)
          .limit(PAGE_SIZE)
          .offset(offset),
      ])

      const total = countResult[0]?.count ?? 0

      return {
        items: results,
        total,
        page: input.page,
        pageSize: PAGE_SIZE,
      }
    }),

  getCandidature: bailleurProcedure('manage_applications')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const application = await db.query.dossierFacileApplications.findFirst({
        where: eq(dossierFacileApplications.id, input.id),
        with: {
          tenant: {
            with: {
              documents: true,
            },
          },
        },
      })

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidature not found' })
      }

      const usr = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        with: { owner: true },
      })

      const isAdmin = usr?.role === 'admin'

      const [accommodation] = await db
        .select({ ...accommodationSelectFields, ownerId: accommodations.ownerId })
        .from(accommodations)
        .innerJoin(
          accommodationAddresses,
          and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
        )
        .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
        .leftJoin(owners, eq(accommodations.ownerId, owners.id))
        .where(eq(accommodations.slug, application.accommodationSlug))
        .limit(1)

      if (!accommodation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
      }

      if (!isAdmin && (!usr?.owner || accommodation.ownerId !== usr.owner.id)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this accommodation' })
      }

      const tenantUser = await db.query.user.findFirst({
        where: eq(user.id, application.tenant.userId),
      })

      const tenantDocs = application.tenant.documents ?? []

      return {
        id: application.id,
        status: application.status,
        apartmentType: application.apartmentType,
        createdAt: application.createdAt,
        reviewedAt: application.reviewedAt,
        studentName: application.tenant.name ?? tenantUser?.name ?? null,
        studentEmail: tenantUser?.email ?? null,
        dfTenantId: application.tenant.id,
        hasTenantUrl: !!application.tenant.url,
        hasPdfUrl: !!application.tenant.pdfUrl,
        tenantStatus: application.tenant.status,
        guarantorCount: application.tenant.guarantorCount ?? 0,
        documents: {
          tenant: tenantDocs.filter((d) => d.ownerType === 'tenant').map(({ url: _url, ...rest }) => rest),
          guarantor: tenantDocs.filter((d) => d.ownerType === 'guarantor').map(({ url: _url, ...rest }) => rest),
        },
        accommodation: mapToGeoJsonFeature(accommodation as unknown as Record<string, unknown>),
      }
    }),

  getDocumentSignedUrl: bailleurProcedure('manage_applications')
    .input(
      z.object({
        type: z.enum(['tenantPdf', 'tenantUrl', 'document']),
        tenantId: z.string().uuid().optional(),
        documentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const REDIRECT_TTL = '60s'

      let targetId: string

      if (input.type === 'document') {
        if (!input.documentId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'documentId is required' })

        const doc = await db.query.dossierFacileDocuments.findFirst({
          where: eq(dossierFacileDocuments.id, input.documentId),
          columns: { id: true, tenantId: true },
        })
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })

        // Verify access via tenant
        const tenant = await db.query.dossierFacileTenants.findFirst({
          where: eq(dossierFacileTenants.id, doc.tenantId),
          columns: { id: true },
        })
        if (!tenant) throw new TRPCError({ code: 'NOT_FOUND' })

        const application = await db.query.dossierFacileApplications.findFirst({
          where: eq(dossierFacileApplications.tenantId, tenant.id),
          columns: { accommodationSlug: true },
        })
        if (!application) throw new TRPCError({ code: 'NOT_FOUND' })

        await verifyOwnerAccess(ctx.session.user.id, application.accommodationSlug)
        targetId = input.documentId
      } else {
        if (!input.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId is required' })

        const application = await db.query.dossierFacileApplications.findFirst({
          where: eq(dossierFacileApplications.tenantId, input.tenantId),
          columns: { accommodationSlug: true },
        })
        if (!application) throw new TRPCError({ code: 'NOT_FOUND' })

        await verifyOwnerAccess(ctx.session.user.id, application.accommodationSlug)
        targetId = input.tenantId
      }

      const token = await new SignJWT({ urlType: input.type, targetId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(ctx.session.user.id)
        .setExpirationTime(REDIRECT_TTL)
        .setIssuedAt()
        .sign(getJwtSecret())

      return { redirectUrl: `/api/df-redirect?token=${token}` }
    }),

  updateCandidatureStatus: bailleurProcedure('manage_applications')
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['accepted', 'rejected']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await db.query.dossierFacileApplications.findFirst({
        where: eq(dossierFacileApplications.id, input.id),
      })

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidature not found' })
      }

      const usr = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        with: { owner: true },
      })

      const isAdmin = usr?.role === 'admin'

      const [accommodation] = await db
        .select({ ownerId: accommodations.ownerId })
        .from(accommodations)
        .where(eq(accommodations.slug, application.accommodationSlug))
        .limit(1)

      if (!accommodation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
      }

      if (!isAdmin && (!usr?.owner || accommodation.ownerId !== usr.owner.id)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this accommodation' })
      }

      const [updated] = await db
        .update(dossierFacileApplications)
        .set({
          status: input.status,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dossierFacileApplications.id, input.id))
        .returning()

      return updated
    }),

  users: createTRPCRouter({
    list: bailleurProcedure('manage_users')
      .input(z.object({ ownerId: z.number().optional(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
        if (!owner) return { items: [] }

        const conditions = [eq(user.ownerId, owner.id), eq(user.role, 'owner')]
        if (input.search && input.search.length >= 2) {
          const searchCondition = or(
            ilike(user.email, `%${input.search}%`),
            ilike(user.firstname, `%${input.search}%`),
            ilike(user.lastname, `%${input.search}%`),
          )
          if (searchCondition) conditions.push(searchCondition)
        }

        const items = await db
          .select({
            id: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            bailleurRole: user.bailleurRole,
            bailleurPermissions: user.bailleurPermissions,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(and(...conditions))
          .orderBy(user.firstname, user.lastname)

        return { items, ownerId: owner.id }
      }),

    getById: bailleurProcedure('manage_users')
      .input(z.object({ id: z.string(), ownerId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
        if (!owner) throw new TRPCError({ code: 'FORBIDDEN' })

        const target = await db.query.user.findFirst({
          where: and(eq(user.id, input.id), eq(user.ownerId, owner.id), eq(user.role, 'owner')),
        })
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' })

        return {
          id: target.id,
          email: target.email,
          firstname: target.firstname,
          lastname: target.lastname,
          bailleurRole: target.bailleurRole,
          bailleurPermissions: target.bailleurPermissions,
        }
      }),

    create: bailleurProcedure('manage_users')
      .input(zCreateBailleurUser.extend({ ownerId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
        if (!owner) throw new TRPCError({ code: 'FORBIDDEN', message: 'Bailleur introuvable' })

        const callerCanGrantAdminRights = canGrantAdministratorRights({
          role: ctx.session.user.role,
          bailleurRole: ctx.session.user.bailleurRole ?? null,
          bailleurPermissions: ctx.session.user.bailleurPermissions ?? [],
        })

        if (!callerCanGrantAdminRights) {
          if (input.bailleurRole === 'administrator') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Seul un administrateur peut creer un autre administrateur' })
          }
          const sensitiveRequested = input.bailleurPermissions.filter((p) => ADMIN_ONLY_PERMISSIONS.includes(p))
          if (sensitiveRequested.length > 0) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Seul un administrateur peut accorder ces permissions: ${sensitiveRequested.join(', ')}`,
            })
          }
        }

        const existing = await db.query.user.findFirst({ where: eq(user.email, input.email) })
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Un utilisateur existe deja avec cet email' })
        }

        const id = crypto.randomUUID()
        const [created] = await db
          .insert(user)
          .values({
            id,
            email: input.email,
            name: `${input.firstname} ${input.lastname}`,
            firstname: input.firstname,
            lastname: input.lastname,
            role: 'owner',
            ownerId: owner.id,
            bailleurRole: input.bailleurRole,
            bailleurPermissions: input.bailleurRole === 'administrator' ? [] : input.bailleurPermissions,
          })
          .returning()

        try {
          const requestHeaders = await headers()
          await auth.api.signInMagicLink({
            body: { email: input.email, callbackURL: '/bailleur/tableau-de-bord' },
            headers: requestHeaders,
          })
        } catch (err) {
          console.error('Erreur envoi magic-link bailleur user', err)
        }

        return created
      }),

    update: bailleurProcedure('manage_users')
      .input(zUpdateBailleurUser.extend({ ownerId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
        if (!owner) throw new TRPCError({ code: 'FORBIDDEN', message: 'Bailleur introuvable' })

        const target = await db.query.user.findFirst({
          where: and(eq(user.id, input.id), eq(user.ownerId, owner.id), eq(user.role, 'owner')),
        })
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' })

        const callerCanGrantAdminRights = canGrantAdministratorRights({
          role: ctx.session.user.role,
          bailleurRole: ctx.session.user.bailleurRole ?? null,
          bailleurPermissions: ctx.session.user.bailleurPermissions ?? [],
        })

        if (!callerCanGrantAdminRights) {
          if (input.bailleurRole === 'administrator') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Seul un administrateur peut promouvoir un utilisateur au role administrateur',
            })
          }
          if (input.bailleurPermissions !== undefined) {
            const sensitiveRequested = input.bailleurPermissions.filter((p) => ADMIN_ONLY_PERMISSIONS.includes(p))
            if (sensitiveRequested.length > 0) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Seul un administrateur peut accorder ces permissions: ${sensitiveRequested.join(', ')}`,
              })
            }
          }
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() }
        if (input.firstname !== undefined) updateData.firstname = input.firstname
        if (input.lastname !== undefined) updateData.lastname = input.lastname
        if (input.firstname !== undefined || input.lastname !== undefined) {
          updateData.name = `${input.firstname ?? target.firstname} ${input.lastname ?? target.lastname}`
        }
        if (input.bailleurRole !== undefined) {
          updateData.bailleurRole = input.bailleurRole
          if (input.bailleurRole === 'administrator') {
            updateData.bailleurPermissions = []
          }
        }
        if (input.bailleurPermissions !== undefined && input.bailleurRole !== 'administrator') {
          updateData.bailleurPermissions = input.bailleurPermissions
        }

        if (target.id === ctx.session.user.id && updateData.bailleurRole && updateData.bailleurRole !== 'administrator') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas retirer votre propre role administrateur' })
        }

        const [updated] = await db.update(user).set(updateData).where(eq(user.id, input.id)).returning()
        return updated
      }),

    delete: bailleurProcedure('manage_users')
      .input(z.object({ id: z.string(), ownerId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.session.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas vous supprimer vous-meme' })
        }

        const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
        if (!owner) throw new TRPCError({ code: 'FORBIDDEN', message: 'Bailleur introuvable' })

        const target = await db.query.user.findFirst({
          where: and(eq(user.id, input.id), eq(user.ownerId, owner.id), eq(user.role, 'owner')),
        })
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' })

        if (target.bailleurRole === 'administrator') {
          const [{ administratorCount }] = await db
            .select({ administratorCount: count() })
            .from(user)
            .where(and(eq(user.ownerId, owner.id), eq(user.bailleurRole, 'administrator'), ne(user.id, target.id)))

          if (administratorCount === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Impossible de supprimer le dernier administrateur du bailleur',
            })
          }
        }

        await db.delete(user).where(eq(user.id, input.id))
        return { id: input.id }
      }),
  }),
})
