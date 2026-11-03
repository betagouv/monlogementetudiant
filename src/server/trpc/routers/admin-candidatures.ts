import { and, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { A_RAPPELER_STATUS, CONTACT_RETENTION_DAYS, EContactStatus } from '~/enums/contact-status'
import { type TAdminCandidaturesPeriod, ZAdminCandidaturesPeriod } from '~/schemas/candidatures/admin-period'
import { contactScholarshipStatus, createdInPeriod } from '~/server/candidatures/admin-period'
import { visibleContactRequest, visibleDossierFacileApplication } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { user } from '~/server/db/schema/auth'
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
const contactCountSql = (period: TAdminCandidaturesPeriod) => sql<number>`(
  select count(*) from ${contactRequests}
  where ${contactRequests.accommodationId} = ${accommodations.id} and ${createdInPeriod(contactRequests.createdAt, period)}
)::int`

const dossierFacileCountSql = (period: TAdminCandidaturesPeriod) => sql<number>`(
  select count(*) from ${dossierFacileApplications}
  where ${dossierFacileApplications.accommodationSlug} = ${accommodations.slug}
    and ${createdInPeriod(dossierFacileApplications.createdAt, period)}
)::int`

const scholarshipHolderCountSql = (period: TAdminCandidaturesPeriod) => sql<number>`(
  (select count(*) from ${contactRequests}
     left join ${user} on ${user.id} = ${contactRequests.userId}
     where ${contactRequests.accommodationId} = ${accommodations.id}
       and ${createdInPeriod(contactRequests.createdAt, period)}
       and ${contactScholarshipStatus} = 'yes')
  + (select count(*) from ${dossierFacileApplications}
     inner join ${dossierFacileTenants} on ${dossierFacileTenants.id} = ${dossierFacileApplications.tenantId}
     inner join ${user} on ${user.id} = ${dossierFacileTenants.userId}
     where ${dossierFacileApplications.accommodationSlug} = ${accommodations.slug}
       and ${createdInPeriod(dossierFacileApplications.createdAt, period)}
       and ${user.scholarshipStatus} = 'yes')
)::int`

/**
 * Candidatures réellement visibles du gestionnaire, tous canaux confondus.
 *
 * Les prédicats viennent du module de visibilité plutôt que d'être réécrits ici : la fenêtre de
 * rétention seule compterait des demandes visiteur non confirmées, qu'aucun gestionnaire ne voit.
 */
const activeCountSql = (period: TAdminCandidaturesPeriod) => sql<number>`(
  (select count(*) from ${contactRequests}
     where ${contactRequests.accommodationId} = ${accommodations.id}
       and ${createdInPeriod(contactRequests.createdAt, period)} and ${visibleContactRequest()})
  + (select count(*) from ${dossierFacileApplications}
     inner join ${dossierFacileTenants} on ${dossierFacileTenants.id} = ${dossierFacileApplications.tenantId}
     where ${dossierFacileApplications.accommodationSlug} = ${accommodations.slug}
       and ${createdInPeriod(dossierFacileApplications.createdAt, period)} and ${visibleDossierFacileApplication()})
)::int`

const hasCandidatureSql = (period: TAdminCandidaturesPeriod) => sql`(
  exists (select 1 from ${contactRequests}
    where ${contactRequests.accommodationId} = ${accommodations.id} and ${createdInPeriod(contactRequests.createdAt, period)})
  or exists (select 1 from ${dossierFacileApplications}
    where ${dossierFacileApplications.accommodationSlug} = ${accommodations.slug}
      and ${createdInPeriod(dossierFacileApplications.createdAt, period)})
)`

const countByScholarshipStatus = (status: SQL) => ({
  yes: sql<number>`count(*) filter (where ${status} = 'yes')::int`,
  no: sql<number>`count(*) filter (where ${status} = 'no')::int`,
  unknown: sql<number>`count(*) filter (where ${status} = 'unknown')::int`,
  missing: sql<number>`count(*) filter (where ${status} is null)::int`,
})

export const adminCandidaturesRouter = createTRPCRouter({
  /** Indicateurs de tête de page, sur les candidatures déposées dans la période. */
  overview: adminProcedure.input(ZAdminCandidaturesPeriod).query(async ({ input }) => {
    const [contactTotals, dossierFacileTotals, residencesConcerned] = await Promise.all([
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${visibleContactRequest()})::int`,
          toProcess: sql<number>`count(*) filter (where ${contactRequests.status} = ${A_RAPPELER_STATUS})::int`,
          ...countByScholarshipStatus(contactScholarshipStatus),
        })
        .from(contactRequests)
        .leftJoin(user, eq(user.id, contactRequests.userId))
        .where(createdInPeriod(contactRequests.createdAt, input)),
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${visibleDossierFacileApplication()})::int`,
          toProcess: sql<number>`count(*) filter (where ${dossierFacileApplications.status} in (${A_RAPPELER_STATUS}, ${EContactStatus.A_MODERER}))::int`,
          ...countByScholarshipStatus(sql`${user.scholarshipStatus}`),
        })
        .from(dossierFacileApplications)
        .innerJoin(dossierFacileTenants, eq(dossierFacileTenants.id, dossierFacileApplications.tenantId))
        .innerJoin(user, eq(user.id, dossierFacileTenants.userId))
        .where(createdInPeriod(dossierFacileApplications.createdAt, input)),
      db.select({ n: count() }).from(accommodations).where(hasCandidatureSql(input)),
    ])

    const contact = contactTotals[0]
    const dossierFacile = dossierFacileTotals[0]
    const sum = (key: 'total' | 'active' | 'toProcess' | 'yes' | 'no' | 'unknown' | 'missing') =>
      (contact?.[key] ?? 0) + (dossierFacile?.[key] ?? 0)

    return {
      total: sum('total'),
      active: sum('active'),
      toProcess: sum('toProcess'),
      residences: residencesConcerned[0]?.n ?? 0,
      contact: contact?.total ?? 0,
      dossierFacile: dossierFacile?.total ?? 0,
      scholarship: { yes: sum('yes'), no: sum('no'), unknown: sum('unknown'), missing: sum('missing') },
      retentionDays: CONTACT_RETENTION_DAYS,
    }
  }),

  /** Résidences ayant reçu au moins une candidature, avec le volume par canal. */
  list: adminProcedure
    .input(ZAdminCandidaturesPeriod.and(z.object({ page: z.number().default(1), search: z.string().optional() })))
    .query(async ({ ctx, input }) => {
      const conditions = [hasCandidatureSql(input)]

      if (input.search && input.search.length >= 2) {
        const search = `%${input.search}%`
        conditions.push(or(ilike(accommodations.name, search), ilike(cities.name, search), ilike(owners.name, search))!)
      }

      const where = and(...conditions)
      const offset = (input.page - 1) * PAGE_SIZE
      const activeCount = activeCountSql(input)

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
            contactCount: contactCountSql(input),
            dossierFacileCount: dossierFacileCountSql(input),
            scholarshipHolderCount: scholarshipHolderCountSql(input),
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
