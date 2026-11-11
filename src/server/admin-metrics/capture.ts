import { addMonths, format } from 'date-fns'
import { type AnyColumn, and, count, eq, gte, inArray, isNotNull, lt, ne, type SQL, sql } from 'drizzle-orm'
import { EContactStatus } from '~/enums/contact-status'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { crousExistsCondition } from '~/server/accommodations/list-query'
import { defaultMonthRange, monthStart, type TMonth } from '~/server/admin-metrics/months'
import { contactScholarshipStatus } from '~/server/candidatures/admin-period'
import { confirmedContactRequest, verifiedDossierFacileTenant } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import {
  accommodationAddresses,
  accommodations,
  activityLog,
  applicationFacts,
  contactRequests,
  dossierFacileApplications,
  dossierFacileTenants,
  monthlyMetrics,
  owners,
  trackingEvents,
  user,
} from '~/server/db/schema'

export type TApplicationChannel = 'contact' | 'dossier_facile'
export type TMetricScope = 'global' | 'owner' | 'city'

type TMetricRow = { metric: EMonthlyMetric; scope: TMetricScope; scopeId: number; value: number; boursiers: number | null }

const STATE_METRICS = [
  EMonthlyMetric.CITY_AVAILABLE,
  EMonthlyMetric.CITY_KNOWN_TOTAL,
  EMonthlyMetric.CITY_PUBLISHED_TOTAL,
  EMonthlyMetric.CITY_OPEN_RESIDENCES,
  EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT,
  EMonthlyMetric.APARTMENTS_PUBLISHED_HORS_CROUS,
  EMonthlyMetric.APARTMENTS_CONTACT_ACTIVATED_HORS_CROUS,
  EMonthlyMetric.RESIDENCES_NULL_TOTAL_HORS_CROUS,
  EMonthlyMetric.OWNERS_CONTACT_ACTIVATED,
  EMonthlyMetric.OWNERS_WITH_AVAILABILITY,
  EMonthlyMetric.STUDENTS_TOTAL,
]

const shiftMonth = (month: TMonth, delta: number): TMonth => format(addMonths(new Date(`${month}-01T00:00:00`), delta), 'yyyy-MM')

const inMonth = (column: AnyColumn, month: TMonth): SQL | undefined =>
  and(gte(column, monthStart(month)), lt(column, monthStart(shiftMonth(month, 1))))

const moderationLog = (entityType: 'contact_request' | 'dossier_facile_application') =>
  db
    .select({
      entityId: activityLog.entityId,
      firstAt: sql<Date>`min(${activityLog.createdAt})`.as('first_at'),
      attributedAt:
        sql<Date | null>`min(${activityLog.createdAt}) filter (where ${activityLog.metadata}->'diff'->'contactStatus'->>'new' = ${EContactStatus.LOGEMENT_ATTRIBUE})`.as(
          'attributed_at',
        ),
    })
    .from(activityLog)
    .where(and(eq(activityLog.action, 'contact.status_updated'), eq(activityLog.entityType, entityType)))
    .groupBy(activityLog.entityId)
    .as('moderation')

const mainAddress = and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true))

const factUpsert = {
  target: applicationFacts.id,
  set: {
    channel: sql`excluded.channel`,
    ownerId: sql`coalesce(excluded.owner_id, ${applicationFacts.ownerId})`,
    accommodationId: sql`coalesce(excluded.accommodation_id, ${applicationFacts.accommodationId})`,
    cityId: sql`coalesce(excluded.city_id, ${applicationFacts.cityId})`,
    scholarshipStatus: sql`coalesce(excluded.scholarship_status, ${applicationFacts.scholarshipStatus})`,
    status: sql`excluded.status`,
    firstTreatedAt: sql`excluded.first_treated_at`,
    contactedAt: sql`excluded.contacted_at`,
    attributedAt: sql`excluded.attributed_at`,
    updatedAt: sql`now()`,
  },
}

const syncContactFacts = async () => {
  const moderation = moderationLog('contact_request')
  const channel: TApplicationChannel = 'contact'
  const rows = await db
    .insert(applicationFacts)
    .select(
      db
        .select({
          id: sql<string>`'contact:' || ${contactRequests.id}`.as('id'),
          channel: sql<string>`${channel}`.as('channel'),
          ownerId: accommodations.ownerId,
          accommodationId: contactRequests.accommodationId,
          cityId: accommodationAddresses.cityId,
          createdAt: contactRequests.createdAt,
          scholarshipStatus: sql`${contactScholarshipStatus}`.as('scholarship_status'),
          status: contactRequests.status,
          firstTreatedAt:
            sql<Date | null>`coalesce(${moderation.firstAt}, ${contactRequests.contactedAt}, ${contactRequests.reviewedAt})`.as(
              'first_treated_at',
            ),
          contactedAt: contactRequests.contactedAt,
          attributedAt:
            sql<Date | null>`coalesce(${moderation.attributedAt}, case when ${contactRequests.status} = ${EContactStatus.LOGEMENT_ATTRIBUE} then ${contactRequests.reviewedAt} end)`.as(
              'attributed_at',
            ),
          updatedAt: sql<Date>`now()`.as('updated_at'),
        })
        .from(contactRequests)
        .innerJoin(accommodations, eq(accommodations.id, contactRequests.accommodationId))
        .leftJoin(accommodationAddresses, mainAddress)
        .leftJoin(user, eq(user.id, contactRequests.userId))
        .leftJoin(moderation, eq(moderation.entityId, sql`${contactRequests.id}::text`))
        .where(confirmedContactRequest()),
    )
    .onConflictDoUpdate(factUpsert)
    .returning({ id: applicationFacts.id })
  return rows.length
}

const syncDossierFacileFacts = async () => {
  const moderation = moderationLog('dossier_facile_application')
  const channel: TApplicationChannel = 'dossier_facile'
  const rows = await db
    .insert(applicationFacts)
    .select(
      db
        .select({
          id: sql<string>`'df:' || ${dossierFacileApplications.id}`.as('id'),
          channel: sql<string>`${channel}`.as('channel'),
          ownerId: accommodations.ownerId,
          accommodationId: accommodations.id,
          cityId: accommodationAddresses.cityId,
          createdAt: dossierFacileApplications.createdAt,
          scholarshipStatus: user.scholarshipStatus,
          status: dossierFacileApplications.status,
          firstTreatedAt:
            sql<Date | null>`coalesce(${moderation.firstAt}, ${dossierFacileApplications.contactedAt}, ${dossierFacileApplications.reviewedAt})`.as(
              'first_treated_at',
            ),
          contactedAt: dossierFacileApplications.contactedAt,
          attributedAt:
            sql<Date | null>`coalesce(${moderation.attributedAt}, case when ${dossierFacileApplications.status} = ${EContactStatus.LOGEMENT_ATTRIBUE} then ${dossierFacileApplications.reviewedAt} end)`.as(
              'attributed_at',
            ),
          updatedAt: sql<Date>`now()`.as('updated_at'),
        })
        .from(dossierFacileApplications)
        .innerJoin(dossierFacileTenants, eq(dossierFacileTenants.id, dossierFacileApplications.tenantId))
        .leftJoin(user, eq(user.id, dossierFacileTenants.userId))
        .leftJoin(accommodations, eq(accommodations.slug, dossierFacileApplications.accommodationSlug))
        .leftJoin(accommodationAddresses, mainAddress)
        .leftJoin(moderation, eq(moderation.entityId, sql`${dossierFacileApplications.id}::text`))
        .where(verifiedDossierFacileTenant()),
    )
    .onConflictDoUpdate(factUpsert)
    .returning({ id: applicationFacts.id })
  return rows.length
}

export const syncApplicationFacts = async (): Promise<number> => (await syncContactFacts()) + (await syncDossierFacileFacts())

const countCounters = async (month: TMonth): Promise<TMetricRow[]> => {
  const [consult] = await db
    .select({
      value: count(),
      boursiers: count(sql`case when ${user.scholarshipStatus} = 'yes' then 1 end`),
    })
    .from(trackingEvents)
    .leftJoin(user, eq(user.id, trackingEvents.userId))
    .where(and(eq(trackingEvents.type, 'accommodation.consult_offer'), inMonth(trackingEvents.createdAt, month)))

  const searches = await db
    .select({ cityId: trackingEvents.cityId, value: count() })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.type, 'search.city'), isNotNull(trackingEvents.cityId), inMonth(trackingEvents.createdAt, month)))
    .groupBy(trackingEvents.cityId)

  return [
    { metric: EMonthlyMetric.CONSULT_OFFER, scope: 'global', scopeId: 0, value: consult.value, boursiers: consult.boursiers },
    ...searches.map(
      (row): TMetricRow => ({
        metric: EMonthlyMetric.SEARCH_CITY,
        scope: 'city',
        scopeId: Number(row.cityId),
        value: row.value,
        boursiers: null,
      }),
    ),
  ]
}

const sumInt = (expression: SQL, condition: SQL = sql`true`) =>
  sql<number>`coalesce(sum(${expression}) filter (where ${condition}), 0)::int`
const countIf = (condition: SQL) => sql<number>`count(*) filter (where ${condition})::int`

const isContactActivated = ne(owners.contactMode, EOwnerContactMode.NONE)
const isOpen = sql`${isContactActivated} and ${accommodations.acceptsApplications} = true and ${accommodations.applicationsSuspendedAt} is null`

const countStates = async (month: TMonth): Promise<TMetricRow[]> => {
  const hasFactInMonth = sql`exists (select 1 from ${applicationFacts} where ${applicationFacts.accommodationId} = ${accommodations.id} and ${inMonth(applicationFacts.createdAt, month)})`

  const cityRows = await db
    .select({
      cityId: accommodationAddresses.cityId,
      available: sumInt(sql`${accommodations.nbAvailableApartments}`),
      knownTotal: sumInt(sql`${accommodations.nbTotalApartments}`, sql`${accommodations.nbAvailableApartments} is not null`),
      publishedTotal: sumInt(sql`${accommodations.nbTotalApartments}`),
      openResidences: countIf(isOpen),
      openWithoutContact: countIf(sql`${isOpen} and not ${hasFactInMonth}`),
    })
    .from(accommodations)
    .innerJoin(accommodationAddresses, mainAddress)
    .leftJoin(owners, eq(owners.id, accommodations.ownerId))
    .where(and(eq(accommodations.published, true), isNotNull(accommodationAddresses.cityId)))
    .groupBy(accommodationAddresses.cityId)

  const [contactPath] = await db
    .select({
      published: sumInt(sql`${accommodations.nbTotalApartments}`),
      activated: sumInt(sql`${accommodations.nbTotalApartments}`, isContactActivated),
      nullTotal: countIf(sql`${accommodations.nbTotalApartments} is null`),
    })
    .from(accommodations)
    .leftJoin(owners, eq(owners.id, accommodations.ownerId))
    .where(and(eq(accommodations.published, true), sql`not ${crousExistsCondition}`))

  const [ownersActivated] = await db.select({ value: count() }).from(owners).where(isContactActivated)

  const [ownersWithAvailability] = await db
    .select({ value: sql<number>`count(distinct ${accommodations.ownerId})::int` })
    .from(accommodations)
    .where(and(eq(accommodations.published, true), sql`${accommodations.nbAvailableApartments} > 0`))

  const [students] = await db
    .select({ value: count(), boursiers: countIf(sql`${user.scholarshipStatus} = 'yes'`) })
    .from(user)
    .where(eq(user.role, 'user'))

  const global = (metric: EMonthlyMetric, value: number, boursiers: number | null = null): TMetricRow => ({
    metric,
    scope: 'global',
    scopeId: 0,
    value,
    boursiers,
  })

  return [
    ...cityRows.flatMap((row) => {
      const city = (metric: EMonthlyMetric, value: number): TMetricRow => ({
        metric,
        scope: 'city',
        scopeId: Number(row.cityId),
        value,
        boursiers: null,
      })
      return [
        city(EMonthlyMetric.CITY_AVAILABLE, row.available),
        city(EMonthlyMetric.CITY_KNOWN_TOTAL, row.knownTotal),
        city(EMonthlyMetric.CITY_PUBLISHED_TOTAL, row.publishedTotal),
        city(EMonthlyMetric.CITY_OPEN_RESIDENCES, row.openResidences),
        city(EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT, row.openWithoutContact),
      ]
    }),
    global(EMonthlyMetric.APARTMENTS_PUBLISHED_HORS_CROUS, contactPath.published),
    global(EMonthlyMetric.APARTMENTS_CONTACT_ACTIVATED_HORS_CROUS, contactPath.activated),
    global(EMonthlyMetric.RESIDENCES_NULL_TOTAL_HORS_CROUS, contactPath.nullTotal),
    global(EMonthlyMetric.OWNERS_CONTACT_ACTIVATED, ownersActivated.value),
    global(EMonthlyMetric.OWNERS_WITH_AVAILABILITY, ownersWithAvailability.value),
    global(EMonthlyMetric.STUDENTS_TOTAL, students.value, students.boursiers),
  ]
}

const INSERT_BATCH = 1000

const insertMetrics = async (executor: Pick<typeof db, 'insert'>, month: TMonth, rows: TMetricRow[], frozen: boolean) => {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    await executor
      .insert(monthlyMetrics)
      .values(rows.slice(i, i + INSERT_BATCH).map((row) => ({ month, ...row })))
      .onConflictDoUpdate({
        target: [monthlyMetrics.month, monthlyMetrics.metric, monthlyMetrics.scope, monthlyMetrics.scopeId],
        set: frozen
          ? {
              value: sql`greatest(${monthlyMetrics.value}, excluded.value)`,
              boursiers: sql`greatest(${monthlyMetrics.boursiers}, excluded.boursiers)`,
              updatedAt: sql`now()`,
            }
          : { value: sql`excluded.value`, boursiers: sql`excluded.boursiers`, updatedAt: sql`now()` },
      })
  }
}

export const captureMonth = async (month: TMonth, now: Date = new Date()): Promise<void> => {
  await insertMetrics(db, month, await countCounters(month), true)

  if (month !== defaultMonthRange(now).to) return

  const states = await countStates(month)
  await db.transaction(async (tx) => {
    await tx.delete(monthlyMetrics).where(and(eq(monthlyMetrics.month, month), inArray(monthlyMetrics.metric, STATE_METRICS)))
    await insertMetrics(tx, month, states, false)
  })
}

export const captureMonthlyMetrics = async ({ backfillMonths = 0, now = new Date() }: { backfillMonths?: number; now?: Date } = {}) => {
  const facts = await syncApplicationFacts()
  const current = defaultMonthRange(now).to
  for (let offset = 0; offset <= backfillMonths; offset++) {
    await captureMonth(shiftMonth(current, -offset), now)
  }
  return { facts }
}
