import { TRPCError } from '@trpc/server'
import { and, asc, count, desc, eq, gt, ilike, inArray, ne, or, type SQL, sql } from 'drizzle-orm'
import { sanitize } from 'isomorphic-dompurify'
import { SignJWT } from 'jose'

import { z } from 'zod'
import { EContactSource, ZContactSource } from '~/enums/contact-source'
import { A_RAPPELER_STATUS, ZContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode, ZOwnerContactMode } from '~/enums/owner-contact-mode'
import { ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { getTypologyLabel } from '~/schemas/accommodations/typology'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { ZUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import { zCreateBailleurUser, zUpdateBailleurUser } from '~/schemas/bailleur-users/bailleur-user-form'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { ADMIN_ONLY_PERMISSIONS, canGrantAdministratorRights } from '~/server/bailleur/permissions'
import {
  CONTACT_STUDENT_NAME_SQL,
  contactStudentName,
  DOSSIER_FACILE_STUDENT_NAME_SQL,
  dossierFacileStudentName,
} from '~/server/candidatures/student-identity'
import {
  findVisibleApplication,
  findVisibleApplicationForTenant,
  findVisibleContactRequest,
  visibleContactRequest,
  visibleDossierFacileApplication,
} from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { contactRequests } from '~/server/db/schema/contacts'
import { departments } from '~/server/db/schema/departments'
import { dossierFacileApplications, dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { owners } from '~/server/db/schema/owners'
import { persistTypologies, typologyAggregates, typologyDraft } from '~/server/lib/typologies'
import { classifyActions, computeDiff } from '~/server/services/accommodation-diff'
import { logActivity } from '~/server/services/activity-logger'
import { triggerAlertDetection } from '~/server/services/alert-detection-trigger'
import { sendOwnerWelcomeEmail, syncBrevoDataUpdated } from '~/server/services/brevo'
import { computeTypologyDiff } from '~/server/services/typology-diff'
import { generateSlug, geocodeAddress } from '~/server/trpc/utils/accommodation-helpers'
import { resolveCityId } from '~/server/trpc/utils/resolve-city'
import { getJwtSecret } from '~/server/utils/jwt-secret'
import { findAvailableSlug } from '~/server/utils/slug'
import { isDossierFacileSelectable } from '~/utils/feature-flags'
import { normalizeAccommodationName } from '~/utils/normalize-accommodation-name'
import { RICH_TEXT_ALLOWED_ATTR, RICH_TEXT_ALLOWED_TAGS } from '~/utils/sanitize-config'
import { bailleurProcedure, createTRPCRouter, ownerProcedure } from '../init'
import { priceMaxComputed, rowsToAccommodationDTOs } from './accommodations'

// Somme des disponibilités (tous types d'appartement) d'une résidence.
// Agrégat dénormalisé maintenu sur l'accommodation (détail par typologie dans `accommodation_typology`).
const DISPONIBILITES_SQL = sql<number>`coalesce(${accommodations.nbAvailableApartments}, 0)::int`

// La règle « dossier validé » est désormais inséparable de la fenêtre de rétention : les deux
// vivent dans `visibleDossierFacileApplication` (src/server/candidatures/visibility.ts).

async function assertOwnsAccommodation(userId: string, accommodationWhere: SQL) {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })
  const isAdmin = usr?.role === 'admin'

  const [accommodation] = await db.select({ ownerId: accommodations.ownerId }).from(accommodations).where(accommodationWhere).limit(1)

  if (!accommodation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
  if (!isAdmin && (!usr?.owner || accommodation.ownerId !== usr.owner.id)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this accommodation' })
  }
}

const verifyOwnerAccess = (userId: string, accommodationSlug: string) =>
  assertOwnsAccommodation(userId, eq(accommodations.slug, accommodationSlug))

const verifyOwnerAccessById = (userId: string, accommodationId: number) =>
  assertOwnsAccommodation(userId, eq(accommodations.id, accommodationId))

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
          pageSize: PAGE_SIZE,
          next: null,
          previous: null,
          minPrice: null,
          maxPrice: null,
          results: [],
        }
      }

      const conditions = [eq(accommodations.ownerId, owner.id)]

      if (input.search && input.search.length >= 3) {
        // Search joins through addresses to match city name
        conditions.push(or(ilike(accommodations.name, `%${input.search}%`), ilike(cities.name, `%${input.search}%`))!)
      }

      if (input.hasAvailability) {
        conditions.push(gt(accommodations.nbAvailableApartments, 0))
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
        pageSize: PAGE_SIZE,
        next: input.page < totalPages ? String(input.page + 1) : null,
        previous: input.page > 1 ? String(input.page - 1) : null,
        minPrice: priceBounds[0]?.minPrice != null ? Number(priceBounds[0].minPrice) : null,
        maxPrice: priceBounds[0]?.maxPrice != null ? Number(priceBounds[0].maxPrice) : null,
        results: await rowsToAccommodationDTOs(results),
      }
    }),
  create: bailleurProcedure('manage_residences')
    .input(
      ZCreateResidence.omit({ imagesFiles: true }).extend({
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

      const slug = await findAvailableSlug(generateSlug(name), db, accommodations)

      // Denormalized aggregates computed from the typology array (child rows persisted below).
      const aggregates = typologyAggregates(typologies)

      const insertValues: typeof accommodations.$inferInsert = {
        name: normalizeAccommodationName(name),
        slug,
        residenceType: fields.residenceType ?? null,
        targetAudience: fields.targetAudience ?? null,
        description: fields.description
          ? sanitize(fields.description, { ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS, ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR })
          : null,
        rentalChargesDetails: fields.rentalChargesDetails ?? null,
        externalUrl: fields.externalUrl || null,
        acceptWaitingList: fields.acceptWaitingList ?? false,
        published: fields.published ?? false,
        scholarshipHoldersPriority: fields.scholarshipHoldersPriority ?? false,
        socialHousingRequired: fields.socialHousingRequired ?? false,
        ownerId: owner.id,
        nbTotalApartments: aggregates.nbTotalApartments,
        priceMin: aggregates.priceMin,
        priceMax: aggregates.priceMax,
        nbAvailableApartments: aggregates.nbAvailableApartments,
        imagesUrls: [],
        // Independent (caller-set) aggregates, not derived from typologies
        nbAccessibleApartments: 0,
        nbColivingApartments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(accommodations)
          .values(insertValues)
          .returning({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name })
        // Les champs numériques de ZTypology sont optionnels : typologyDraft normalise undefined → null.
        await persistTypologies(
          tx,
          row.id,
          typologies.map((t) => typologyDraft(t.type, t)),
        )
        return row
      })

      // Geocode + resolve cities in parallel, then batch insert
      const resolved = await Promise.all(
        addresses.map(async (addr, i) => {
          const [coords, cityId] = await Promise.all([
            geocodeAddress(addr.address, addr.city, addr.postalCode),
            resolveCityId(addr.postalCode, addr.city),
          ])
          const values: typeof accommodationAddresses.$inferInsert = {
            accommodationId: created.id,
            isMain: i === 0,
            address: addr.address,
            postalCode: addr.postalCode,
            cityId,
          }
          if (coords) {
            ;(values as Record<string, unknown>).geom = sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)`
          }
          return values
        }),
      )
      await db.insert(accommodationAddresses).values(resolved)

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

      await triggerAlertDetection([created.id])

      return { slug: created.slug }
    }),

  update: bailleurProcedure('manage_residences')
    .input(z.object({ slug: z.string() }).merge(ZUpdateResidence))
    .mutation(async ({ ctx, input }) => {
      const { slug, addresses: inputAddresses, typologies, ...fields } = input
      const { owner, accommodationId } = await verifyOwnership(slug, ctx.session.user.id)

      // Snapshot current state for diff
      const [snapshot] = await db.select().from(accommodations).where(eq(accommodations.slug, slug)).limit(1)

      // Les typologies vivent dans une table enfant : computeDiff ne les voit pas, il faut donc
      // photographier les lignes avant écriture pour pouvoir les comparer ensuite.
      const typologiesBefore =
        typologies === undefined
          ? []
          : await db.select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, accommodationId))

      // Input fields are already camelCase = DB column names, so no snake→camel mapping is needed.
      const camelFields: Record<string, unknown> = { ...fields }
      if (typeof camelFields.name === 'string') {
        camelFields.name = normalizeAccommodationName(camelFields.name)
      }
      if (typeof camelFields.description === 'string') {
        camelFields.description = sanitize(camelFields.description, {
          ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
          ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
        })
      }
      const userProvidedKeys = new Set(Object.keys(camelFields))
      const parentSet: Record<string, unknown> = { ...camelFields }

      // When typologies are provided, refresh the denormalized parent aggregates.
      if (typologies) {
        const aggregates = typologyAggregates(typologies)
        parentSet.nbTotalApartments = aggregates.nbTotalApartments
        parentSet.priceMin = aggregates.priceMin
        parentSet.priceMax = aggregates.priceMax
        parentSet.nbAvailableApartments = aggregates.nbAvailableApartments
      }

      // Handle addresses update
      if (inputAddresses !== undefined) {
        // Geocode in parallel, then delete old + batch insert
        const resolved = await Promise.all(
          inputAddresses.map(async (addr, i) => {
            const [coords, cityId] = await Promise.all([
              geocodeAddress(addr.address, addr.city, addr.postalCode),
              resolveCityId(addr.postalCode, addr.city),
            ])
            const values: typeof accommodationAddresses.$inferInsert = {
              accommodationId,
              isMain: i === 0,
              address: addr.address,
              postalCode: addr.postalCode,
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

      parentSet.updatedAt = new Date()

      const updated = await db.transaction(async (tx) => {
        if (typologies)
          await persistTypologies(
            tx,
            accommodationId,
            typologies.map((t) => typologyDraft(t.type, t)),
          )
        const [row] = await tx
          .update(accommodations)
          .set(parentSet)
          .where(eq(accommodations.slug, slug))
          .returning({ slug: accommodations.slug, name: accommodations.name })
        return row
      })

      if (snapshot) {
        const diff = {
          ...computeDiff(snapshot as Record<string, unknown>, camelFields, userProvidedKeys),
          ...(typologies === undefined
            ? {}
            : computeTypologyDiff(
                typologiesBefore,
                typologies.map((t) => typologyDraft(t.type, t)),
              )),
        }
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

      // Les disponibilités passent désormais par les typologies : on redéclenche la détection d'alertes
      // dès qu'un lot de typologies est fourni (superset sûr — la détection recompute de toute façon).
      if (typologies !== undefined) {
        await triggerAlertDetection([accommodationId])
      }

      return updated
    }),

  updateAvailability: bailleurProcedure('manage_availability')
    .input(z.object({ slug: z.string() }).merge(ZUpdateResidenceList))
    .mutation(async ({ ctx, input }) => {
      const { slug, availability } = input
      const { owner, accommodationId } = await verifyOwnership(slug, ctx.session.user.id)

      // Overlay the new availability onto the current typology rows by type, then recompute aggregates.
      const currentRows = await db
        .select()
        .from(accommodationTypologies)
        .where(eq(accommodationTypologies.accommodationId, accommodationId))
      const availByType = new Map(availability.map((a) => [a.type, a.nbAvailable]))

      // Validation serveur (miroir du client `createUpdateResidenceListSchema`) : la dispo ne peut
      // dépasser le total de la typologie, et une typologie sans total ne peut recevoir de dispo.
      const totalByType = new Map(currentRows.map((r) => [r.type, r.nbTotal]))
      for (const entry of availability) {
        if (entry.nbAvailable == null) continue
        const total = totalByType.get(entry.type) ?? null
        if (total == null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Veuillez d'abord renseigner le nombre total de logements ${getTypologyLabel(entry.type)}`,
          })
        }
        if (entry.nbAvailable > total) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Le nombre de logements ${getTypologyLabel(entry.type)} disponibles ne peut pas être supérieur au nombre total (${total})`,
          })
        }
      }

      const newTypologies = currentRows.map((r) => ({
        type: r.type,
        priceMin: r.priceMin,
        priceMax: r.priceMax,
        superficieMin: r.superficieMin,
        superficieMax: r.superficieMax,
        nbTotal: r.nbTotal,
        nbAvailable: availByType.has(r.type) ? (availByType.get(r.type) ?? null) : r.nbAvailable,
        colocation: r.colocation,
      }))
      const aggregates = typologyAggregates(newTypologies)

      const updated = await db.transaction(async (tx) => {
        await persistTypologies(tx, accommodationId, newTypologies)
        const [row] = await tx
          .update(accommodations)
          .set({
            nbTotalApartments: aggregates.nbTotalApartments,
            priceMin: aggregates.priceMin,
            priceMax: aggregates.priceMax,
            nbAvailableApartments: aggregates.nbAvailableApartments,
            updatedAt: new Date(),
          })
          .where(eq(accommodations.slug, slug))
          .returning({ slug: accommodations.slug, name: accommodations.name })
        return row
      })

      await logActivity({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        action: 'accommodation.availability_updated',
        entityType: 'accommodation',
        entityName: updated.name,
        ownerId: owner?.id,
        ownerName: owner?.name,
        metadata: { slug: updated.slug, diff: computeTypologyDiff(currentRows, newTypologies) },
      })

      // Sync Brevo : si toutes les résidences du owner ont au moins une dispo renseignée
      try {
        if (!owner) throw new Error('Owner introuvable pour la sync Brevo')

        const residencesWithoutAvailability = await db
          .select({ slug: accommodations.slug })
          .from(accommodations)
          .where(and(eq(accommodations.ownerId, owner.id), sql`${accommodations.nbAvailableApartments} IS NULL`))
          .limit(1)

        if (residencesWithoutAvailability.length === 0) {
          await syncBrevoDataUpdated(ctx.session.user.email)
        }
      } catch (err) {
        console.error('Erreur sync Brevo DATE_DERNIERE_MAJ_DONNEES', err)
      }

      await triggerAlertDetection([accommodationId])

      return updated
    }),

  listCandidatures: bailleurProcedure('manage_applications')
    .input(
      z.object({
        page: z.number().default(1),
        // Anciennement `pending | accepted | rejected` : un vocabulaire mort, qui ne pouvait matcher
        // aucune ligne — `dossier_facile_application.status` porte les valeurs de `EContactStatus`.
        status: ZContactStatus.optional(),
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

      const conditions = [inArray(dossierFacileApplications.accommodationSlug, slugs), visibleDossierFacileApplication()!]

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
      // Hors rétention ou dossier non validé, la candidature n'est pas consultable, même par URL directe.
      const application = await findVisibleApplication(input.id)
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
        accommodationSlug: application.accommodationSlug,
        accommodationName: accommodation.name,
        studentName: dossierFacileStudentName(application.tenant, tenantUser),
        studentEmail: tenantUser?.email ?? null,
        studentPhone: tenantUser?.phone ?? null,
        studentBirthdate: tenantUser?.birthdate ?? null,
        scholarshipStatus: tenantUser?.scholarshipStatus ?? null,
        dfTenantId: application.tenant.id,
        hasTenantUrl: !!application.tenant.url,
        hasPdfUrl: !!application.tenant.pdfUrl,
        tenantStatus: application.tenant.status,
        guarantorCount: application.tenant.guarantorCount ?? 0,
        documents: {
          tenant: tenantDocs.filter((d) => d.ownerType === 'tenant').map(({ url: _url, ...rest }) => rest),
          guarantor: tenantDocs.filter((d) => d.ownerType === 'guarantor').map(({ url: _url, ...rest }) => rest),
        },
        accommodation: (await rowsToAccommodationDTOs([accommodation]))[0],
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

        const application = await findVisibleApplicationForTenant(tenant.id)
        if (!application) throw new TRPCError({ code: 'NOT_FOUND' })

        await verifyOwnerAccess(ctx.session.user.id, application.accommodationSlug)
        targetId = input.documentId
      } else {
        if (!input.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId is required' })

        const application = await findVisibleApplicationForTenant(input.tenantId)
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

  // ─── Espace Contacts ─────────────────────────────────────────────────────

  // Active/change le mode de réception des candidatures (self-service).
  setContactMode: bailleurProcedure('manage_applications')
    .input(z.object({ mode: ZOwnerContactMode, ownerId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.mode === EOwnerContactMode.DOSSIER_FACILE && !isDossierFacileSelectable()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'DossierFacile is not available yet' })
      }

      const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
      if (!owner) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' })

      const previousMode = owner.contactMode
      await db.update(owners).set({ contactMode: input.mode, updatedBy: ctx.session.user.id }).where(eq(owners.id, owner.id))

      // Le choix du mode (DossierFacile / coordonnées / aucun) est tracé dans le journal : c'est
      // l'indicateur d'adoption suivi côté administration. On n'enregistre que les vrais changements.
      if (previousMode !== input.mode) {
        await logActivity({
          userId: ctx.session.user.id,
          userName: ctx.session.user.name,
          action: 'owner.contact_mode_updated',
          entityType: 'owner',
          entityId: String(owner.id),
          entityName: owner.name,
          ownerId: owner.id,
          ownerName: owner.name,
          metadata: { diff: { contactMode: { old: previousMode, new: input.mode } } },
        })
      }

      return { contactMode: input.mode }
    }),

  // Grille de résidences avec le nombre de contacts « à rappeler » (statut a_contacter).
  listResidencesWithContactCounts: bailleurProcedure('manage_applications')
    .input(z.object({ search: z.string().optional(), ownerId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const owner = await getOwnerForUser(ctx.session.user.id, input.ownerId)
      if (!owner) return { mode: EOwnerContactMode.NONE, residences: [] }

      const conditions = [eq(accommodations.ownerId, owner.id)]
      if (input.search && input.search.length >= 2) {
        conditions.push(ilike(accommodations.name, `%${input.search}%`))
      }

      const residencesRows = await db
        .select({
          id: accommodations.id,
          slug: accommodations.slug,
          name: accommodations.name,
          cityName: cities.name,
          departmentCode: departments.code,
          disponibilites: DISPONIBILITES_SQL,
        })
        .from(accommodations)
        .leftJoin(
          accommodationAddresses,
          and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
        )
        .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
        .leftJoin(departments, eq(cities.departmentId, departments.id))
        .where(and(...conditions))
        .orderBy(asc(accommodations.name))

      const slugs = residencesRows.map((r) => r.slug)
      const countMap = new Map<string, number>()

      if (slugs.length > 0 && owner.contactMode === EOwnerContactMode.DOSSIER_FACILE) {
        const counts = await db
          .select({ slug: dossierFacileApplications.accommodationSlug, n: sql<number>`count(*)::int` })
          .from(dossierFacileApplications)
          .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
          .where(
            and(
              inArray(dossierFacileApplications.accommodationSlug, slugs),
              eq(dossierFacileApplications.status, A_RAPPELER_STATUS),
              visibleDossierFacileApplication(),
            ),
          )
          .groupBy(dossierFacileApplications.accommodationSlug)
        for (const c of counts) countMap.set(c.slug, c.n)
      } else if (slugs.length > 0 && owner.contactMode === EOwnerContactMode.CONTACTS) {
        const counts = await db
          .select({ slug: accommodations.slug, n: sql<number>`count(*)::int` })
          .from(contactRequests)
          .innerJoin(accommodations, eq(contactRequests.accommodationId, accommodations.id))
          .where(
            and(
              inArray(
                contactRequests.accommodationId,
                residencesRows.map((r) => r.id),
              ),
              eq(contactRequests.status, A_RAPPELER_STATUS),
              visibleContactRequest(),
            ),
          )
          .groupBy(accommodations.slug)
        for (const c of counts) countMap.set(c.slug, c.n)
      }

      return {
        mode: owner.contactMode,
        residences: residencesRows.map((r) => ({ ...r, aRappelerCount: countMap.get(r.slug) ?? 0 })),
      }
    }),

  // Détail d'une résidence + ses contacts (source selon le mode du gestionnaire).
  listContactsByResidence: bailleurProcedure('manage_applications')
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyOwnerAccess(ctx.session.user.id, input.slug)

      const [residence] = await db
        .select({
          id: accommodations.id,
          name: accommodations.name,
          cityName: cities.name,
          departmentCode: departments.code,
          disponibilites: DISPONIBILITES_SQL,
          mode: owners.contactMode,
        })
        .from(accommodations)
        .leftJoin(
          accommodationAddresses,
          and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
        )
        .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
        .leftJoin(departments, eq(cities.departmentId, departments.id))
        .leftJoin(owners, eq(accommodations.ownerId, owners.id))
        .where(eq(accommodations.slug, input.slug))
        .limit(1)

      if (!residence) throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })

      const mode = residence.mode ?? EOwnerContactMode.NONE

      let items: Array<{
        id: string
        studentName: string | null
        scholarshipStatus: string | null
        apartmentType: string | null
        status: string
        createdAt: Date
        source: EContactSource
      }> = []

      if (mode === EOwnerContactMode.DOSSIER_FACILE) {
        items = await db
          .select({
            id: dossierFacileApplications.id,
            studentName: DOSSIER_FACILE_STUDENT_NAME_SQL,
            scholarshipStatus: user.scholarshipStatus,
            apartmentType: dossierFacileApplications.apartmentType,
            status: dossierFacileApplications.status,
            createdAt: dossierFacileApplications.createdAt,
            source: sql<EContactSource.DOSSIER_FACILE>`'dossier_facile'`,
          })
          .from(dossierFacileApplications)
          .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
          .leftJoin(user, eq(dossierFacileTenants.userId, user.id))
          .where(and(eq(dossierFacileApplications.accommodationSlug, input.slug), visibleDossierFacileApplication()))
          .orderBy(desc(dossierFacileApplications.createdAt))
      } else if (mode === EOwnerContactMode.CONTACTS) {
        items = await db
          .select({
            id: contactRequests.id,
            studentName: CONTACT_STUDENT_NAME_SQL,
            scholarshipStatus: user.scholarshipStatus,
            apartmentType: contactRequests.apartmentType,
            status: contactRequests.status,
            createdAt: contactRequests.createdAt,
            source: sql<EContactSource.CONTACT>`'contact'`,
          })
          .from(contactRequests)
          .leftJoin(user, eq(contactRequests.userId, user.id))
          .where(and(eq(contactRequests.accommodationId, residence.id), visibleContactRequest()))
          .orderBy(desc(contactRequests.createdAt))
      }

      return {
        residence: {
          name: residence.name,
          cityName: residence.cityName,
          departmentCode: residence.departmentCode,
          disponibilites: residence.disponibilites,
        },
        mode,
        items,
      }
    }),

  // Détail des coordonnées d'un contact (mode contacts).
  getContact: bailleurProcedure('manage_applications')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const request = await findVisibleContactRequest(input.id)
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' })

      await verifyOwnerAccessById(ctx.session.user.id, request.accommodationId)

      return {
        id: request.id,
        status: request.status,
        apartmentType: request.apartmentType,
        createdAt: request.createdAt,
        reviewedAt: request.reviewedAt,
        accommodationId: request.accommodationId,
        accommodationName: request.accommodation.name,
        studentName: contactStudentName(request),
        studentEmail: request.email ?? request.user?.email ?? null,
        studentPhone: request.phone ?? request.user?.phone ?? null,
        studentBirthdate: request.user?.birthdate ?? null,
        scholarshipStatus: request.user?.scholarshipStatus ?? null,
      }
    }),

  // Changement de statut (drag & drop du board) — DossierFacile ou contact.
  updateContactStatus: bailleurProcedure('manage_applications')
    .input(z.object({ id: z.string().uuid(), status: ZContactStatus, source: ZContactSource }))
    .mutation(async ({ ctx, input }) => {
      if (input.source === EContactSource.DOSSIER_FACILE) {
        // Même porte que la lecture : une candidature hors rétention ou au dossier non validé n'est
        // pas plus mutable qu'elle n'est consultable.
        const application = await findVisibleApplication(input.id)
        if (!application) throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidature not found' })

        await verifyOwnerAccess(ctx.session.user.id, application.accommodationSlug)

        const [updated] = await db
          .update(dossierFacileApplications)
          .set({ status: input.status, reviewedAt: new Date(), updatedAt: new Date() })
          .where(eq(dossierFacileApplications.id, input.id))
          .returning()
        return updated
      }

      const request = await findVisibleContactRequest(input.id)
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' })

      await verifyOwnerAccessById(ctx.session.user.id, request.accommodationId)

      const [updated] = await db
        .update(contactRequests)
        .set({ status: input.status, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(contactRequests.id, input.id))
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
          await sendOwnerWelcomeEmail(created.email, { firstname: input.firstname, lastname: input.lastname })
        } catch (err) {
          console.error('Erreur envoi email bienvenue gestionnaire', err)
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
        if (input.email !== undefined && input.email !== target.email) {
          const existing = await db.query.user.findFirst({
            where: and(eq(user.email, input.email), ne(user.id, target.id)),
          })
          if (existing) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Un utilisateur existe deja avec cet email' })
          }
          updateData.email = input.email
        }
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
