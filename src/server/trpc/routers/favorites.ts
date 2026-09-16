import { TRPCError } from '@trpc/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { alertJobs } from '~/server/db/schema/alert-jobs'
import { cities } from '~/server/db/schema/cities'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { owners } from '~/server/db/schema/owners'
import { groupTypologiesByAccommodation, typologiesByType } from '~/server/lib/typologies'
import { createTRPCRouter, userProcedure } from '../init'
import { priceMaxComputed, toAccommodationDTO } from './accommodations'

/** Candidature de l'étudiant sur une résidence, telle que restituée sur la carte. */
export type TFavoriteApplicationKind = 'dossier_facile' | 'contact'

interface FavoriteApplication {
  kind: TFavoriteApplicationKind
  createdAt: Date
}

/**
 * Toutes les candidatures de l'étudiant, indexées par résidence. Une candidature DossierFacile prime
 * sur un simple partage de coordonnées : c'est la plus engageante des deux.
 *
 * Sert à deux choses : afficher le bandeau de statut sur la carte, et faire figurer la résidence
 * dans l'espace étudiant même si le favori a été retiré depuis.
 */
const fetchApplications = async (userId: string): Promise<Map<number, FavoriteApplication>> => {
  const [contactRows, dossierFacileRows] = await Promise.all([
    db
      .select({ accommodationId: contactRequests.accommodationId, createdAt: contactRequests.createdAt })
      .from(contactRequests)
      .where(eq(contactRequests.userId, userId)),
    db
      .select({ accommodationId: accommodations.id, createdAt: dossierFacileApplications.createdAt })
      .from(dossierFacileApplications)
      .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
      .innerJoin(accommodations, eq(accommodations.slug, dossierFacileApplications.accommodationSlug))
      .where(eq(dossierFacileTenants.userId, userId)),
  ])

  const applications = new Map<number, FavoriteApplication>()
  for (const { accommodationId, createdAt } of contactRows) applications.set(accommodationId, { kind: 'contact', createdAt })
  for (const { accommodationId, createdAt } of dossierFacileRows) applications.set(accommodationId, { kind: 'dossier_facile', createdAt })

  return applications
}

export const favoritesRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    // Une candidature vaut suivi de la résidence : elle reste listée même si le favori a été retiré
    // depuis (la carte s'affiche alors avec le cœur vide).
    const applications = await fetchApplications(userId)
    const favoriteIds = await db
      .select({ accommodationId: favoriteAccommodations.accommodationId })
      .from(favoriteAccommodations)
      .where(eq(favoriteAccommodations.userId, userId))

    const followedIds = [...new Set([...favoriteIds.map((f) => f.accommodationId), ...applications.keys()])]
    if (followedIds.length === 0) return []

    const results = await db
      .select({
        id: favoriteAccommodations.id,
        createdAt: favoriteAccommodations.createdAt,
        accommodationId: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        description: accommodations.description,
        address: accommodationAddresses.address,
        city: cities.name,
        citySlug: cities.slug,
        postalCode: accommodationAddresses.postalCode,
        residenceType: accommodations.residenceType,
        targetAudience: accommodations.targetAudience,
        published: accommodations.published,
        nbTotalApartments: accommodations.nbTotalApartments,
        nbAccessibleApartments: accommodations.nbAccessibleApartments,
        nbColivingApartments: accommodations.nbColivingApartments,
        priceMin: accommodations.priceMin,
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
      .leftJoin(
        favoriteAccommodations,
        and(eq(favoriteAccommodations.accommodationId, accommodations.id), eq(favoriteAccommodations.userId, userId)),
      )
      .innerJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .leftJoin(owners, eq(accommodations.ownerId, owners.id))
      .where(and(inArray(accommodations.id, followedIds), eq(accommodations.published, true)))

    const accIds = results.map((r) => r.accommodationId)
    const typologyRows =
      accIds.length > 0
        ? await db.select().from(accommodationTypologies).where(inArray(accommodationTypologies.accommodationId, accIds))
        : []
    const typologiesByAccommodation = groupTypologiesByAccommodation(typologyRows)

    return results
      .map((row) => {
        const application = applications.get(row.accommodationId) ?? null
        return {
          id: row.id,
          accommodation: toAccommodationDTO(
            { ...row, id: row.accommodationId },
            typologiesByType(typologiesByAccommodation.get(row.accommodationId) ?? []),
          ),
          /** `false` = résidence suivie via une candidature seule, cœur vide sur la carte. */
          isFavorite: row.id !== null,
          application: application?.kind ?? null,
          // Une résidence suivie sans favori n'a pas de date de mise en favori : on retombe sur la
          // date de candidature, sinon elle n'aurait pas de rang dans la liste.
          created_at: row.createdAt ?? application?.createdAt ?? null,
        }
      })
      .sort((a, b) => (b.created_at?.getTime() ?? 0) - (a.created_at?.getTime() ?? 0))
  }),

  add: userProcedure.input(z.object({ accommodationSlug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const accom = await db.query.accommodations.findFirst({
      where: and(eq(accommodations.slug, input.accommodationSlug), eq(accommodations.published, true)),
      columns: { id: true },
    })

    if (!accom) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `[favorites.add] Accommodation not found: ${input.accommodationSlug}` })
    }

    const [row] = await db
      .insert(favoriteAccommodations)
      .values({
        userId,
        accommodationId: accom.id,
      })
      .onConflictDoNothing()
      .returning()

    if (!row) {
      const existing = await db.query.favoriteAccommodations.findFirst({
        where: and(eq(favoriteAccommodations.userId, userId), eq(favoriteAccommodations.accommodationId, accom.id)),
      })
      return existing!
    }

    return row
  }),

  remove: userProcedure.input(z.object({ slug: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const accom = await db.query.accommodations.findFirst({
      where: eq(accommodations.slug, input.slug),
      columns: { id: true },
    })

    if (!accom) return { success: true }

    await db
      .delete(favoriteAccommodations)
      .where(and(eq(favoriteAccommodations.userId, userId), eq(favoriteAccommodations.accommodationId, accom.id)))

    // Annuler les jobs pending issus de ce favori pour éviter un email post-suppression.
    await db
      .delete(alertJobs)
      .where(
        and(
          eq(alertJobs.userId, userId),
          eq(alertJobs.accommodationId, accom.id),
          eq(alertJobs.source, 'favorite'),
          eq(alertJobs.status, 'pending'),
        ),
      )

    return { success: true }
  }),
})
