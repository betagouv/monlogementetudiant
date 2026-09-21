import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { A_RAPPELER_STATUS, CONTACT_RETENTION_DAYS, EContactStatus } from '~/enums/contact-status'
import { visibleContactRequest, visibleDossierFacileApplication } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { cities } from '~/server/db/schema/cities'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { owners } from '~/server/db/schema/owners'
import { adminProcedure, createTRPCRouter } from '../init'

const PAGE_SIZE = 20

/**
 * Une candidature est soit une demande de contact, soit une candidature DossierFacile. Les deux
 * tables se rattachent différemment à la résidence : `contact_request` par identifiant,
 * `dossier_facile_application` par slug. D'où ces sous-requêtes corrélées plutôt qu'une jointure.
 */
const CONTACT_COUNT = sql<number>`(
  select count(*) from ${contactRequests} cr where cr.accommodation_id = ${accommodations.id}
)::int`

const DOSSIER_FACILE_COUNT = sql<number>`(
  select count(*) from ${dossierFacileApplications} dfa where dfa.accommodation_slug = ${accommodations.slug}
)::int`

/**
 * Candidatures réellement visibles du gestionnaire, tous canaux confondus.
 *
 * Les prédicats viennent du module de visibilité plutôt que d'être réécrits ici : la fenêtre de
 * rétention seule compterait des demandes visiteur non confirmées, qu'aucun gestionnaire ne voit.
 */
const activeCountSql = () => sql<number>`(
  (select count(*) from ${contactRequests}
     where ${contactRequests.accommodationId} = ${accommodations.id} and ${visibleContactRequest()})
  + (select count(*) from ${dossierFacileApplications}
     inner join ${dossierFacileTenants} on ${dossierFacileTenants.id} = ${dossierFacileApplications.tenantId}
     where ${dossierFacileApplications.accommodationSlug} = ${accommodations.slug} and ${visibleDossierFacileApplication()})
)::int`

const HAS_CANDIDATURE = sql`(
  exists (select 1 from ${contactRequests} cr where cr.accommodation_id = ${accommodations.id})
  or exists (select 1 from ${dossierFacileApplications} dfa where dfa.accommodation_slug = ${accommodations.slug})
)`

export const adminCandidaturesRouter = createTRPCRouter({
  /** Indicateurs de tête de page. */
  overview: adminProcedure.query(async () => {
    const [contactTotals, dossierFacileTotals, residencesConcerned] = await Promise.all([
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${visibleContactRequest()})::int`,
          toProcess: sql<number>`count(*) filter (where ${contactRequests.status} = ${A_RAPPELER_STATUS})::int`,
        })
        .from(contactRequests),
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${visibleDossierFacileApplication()})::int`,
          toProcess: sql<number>`count(*) filter (where ${dossierFacileApplications.status} in (${A_RAPPELER_STATUS}, ${EContactStatus.A_MODERER}))::int`,
        })
        .from(dossierFacileApplications)
        .innerJoin(dossierFacileTenants, eq(dossierFacileTenants.id, dossierFacileApplications.tenantId)),
      db.select({ n: count() }).from(accommodations).where(HAS_CANDIDATURE),
    ])

    const contact = contactTotals[0]
    const dossierFacile = dossierFacileTotals[0]

    return {
      total: (contact?.total ?? 0) + (dossierFacile?.total ?? 0),
      active: (contact?.active ?? 0) + (dossierFacile?.active ?? 0),
      toProcess: (contact?.toProcess ?? 0) + (dossierFacile?.toProcess ?? 0),
      residences: residencesConcerned[0]?.n ?? 0,
      contact: contact?.total ?? 0,
      dossierFacile: dossierFacile?.total ?? 0,
      retentionDays: CONTACT_RETENTION_DAYS,
    }
  }),

  /** Résidences ayant reçu au moins une candidature, avec le volume par canal. */
  list: adminProcedure.input(z.object({ page: z.number().default(1), search: z.string().optional() })).query(async ({ ctx, input }) => {
    const conditions = [HAS_CANDIDATURE]

    if (input.search && input.search.length >= 2) {
      const search = `%${input.search}%`
      conditions.push(or(ilike(accommodations.name, search), ilike(cities.name, search), ilike(owners.name, search))!)
    }

    const where = and(...conditions)
    const offset = (input.page - 1) * PAGE_SIZE
    const activeCount = activeCountSql()

    const [countResult, results, linkedOwners] = await Promise.all([
      db
        .select({ n: count() })
        .from(accommodations)
        .leftJoin(owners, eq(accommodations.ownerId, owners.id))
        .leftJoin(
          accommodationAddresses,
          and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
        )
        .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
        .where(where),
      db
        .select({
          id: accommodations.id,
          name: accommodations.name,
          slug: accommodations.slug,
          city: cities.name,
          ownerId: owners.id,
          ownerName: owners.name,
          contactMode: owners.contactMode,
          contactCount: CONTACT_COUNT,
          dossierFacileCount: DOSSIER_FACILE_COUNT,
          activeCount,
        })
        .from(accommodations)
        .leftJoin(owners, eq(accommodations.ownerId, owners.id))
        .leftJoin(
          accommodationAddresses,
          and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
        )
        .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
        .where(where)
        .orderBy(desc(activeCount), accommodations.name)
        .limit(PAGE_SIZE)
        .offset(offset),
      // Un admin n'atteint l'espace d'un gestionnaire que s'il y est rattaché : sans ce lien, la
      // redirection retomberait silencieusement sur un autre bailleur.
      db.select({ ownerId: adminOwnerLinks.ownerId }).from(adminOwnerLinks).where(eq(adminOwnerLinks.userId, ctx.session.user.id)),
    ])

    const linkedOwnerIds = new Set(linkedOwners.map((l) => l.ownerId))
    const total = countResult[0]?.n ?? 0

    return {
      items: results.map((row) => ({
        ...row,
        ownerName: row.ownerName ?? '-',
        city: row.city ?? '-',
        total: row.contactCount + row.dossierFacileCount,
        canAccessOwnerSpace: row.ownerId !== null && linkedOwnerIds.has(row.ownerId),
      })),
      total,
      pageCount: Math.ceil(total / PAGE_SIZE),
      page: input.page,
    }
  }),
})
