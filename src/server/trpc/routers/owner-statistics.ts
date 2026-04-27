import { TRPCError } from '@trpc/server'
import { and, between, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { trackingEvents } from '~/server/db/schema/tracking-events'
import { createTRPCRouter, ownerProcedure } from '../init'

const periodInput = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  ownerId: z.number().int().positive().optional(),
})

const ACCOMMODATIONS_PAGE_SIZE = 4
const CITIES_PAGE_SIZE = 10

const paginatedInput = periodInput.extend({
  page: z.number().int().positive().default(1),
  search: z.string().default(''),
})

type Period = z.infer<typeof periodInput>['period']

function periodToDays(period: Period): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90
}

function getDateRange(period: Period): { from: Date; to: Date; days: number } {
  const days = periodToDays(period)
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from, to, days }
}

function getPreviousDateRange(period: Period): { from: Date; to: Date } {
  const days = periodToDays(period)
  const to = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from, to }
}

function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

async function getOwnerTerritories(ownerId: number) {
  const rows = await db
    .select({
      cityId: accommodationAddresses.cityId,
      departmentId: cities.departmentId,
    })
    .from(accommodations)
    .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
    .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .where(and(eq(accommodations.ownerId, ownerId), eq(accommodationAddresses.isMain, true)))

  const cityIds = [...new Set(rows.map((r) => r.cityId).filter((v): v is number => v !== null))]
  const departmentIds = [...new Set(rows.map((r) => r.departmentId).filter((v): v is number => v !== null))]
  return { cityIds, departmentIds }
}

async function resolveOwnerOrThrow(userId: string, ownerId: number | undefined) {
  const owner = await getOwnerForUser(userId, ownerId)
  if (!owner) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No owner record for this user' })
  }
  return owner
}

async function withQueryLogging<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const cause = (err as { cause?: unknown }).cause
    const causeMessage = cause instanceof Error ? cause.message : String(cause ?? 'unknown')
    const causeCode = (cause as { code?: string } | undefined)?.code
    const causeDetail = (cause as { detail?: string } | undefined)?.detail
    console.error(`[ownerStatistics:${label}] PG error:`, {
      code: causeCode,
      message: causeMessage,
      detail: causeDetail,
      cause,
    })
    throw err
  }
}

const TYPE_SEARCH_CITY = 'search.city'
const TYPE_SEARCH_DEPARTMENT = 'search.department'
const TYPE_VIEWED = 'accommodation.viewed'
const TYPE_CONSULT_OFFER = 'accommodation.consult_offer'

async function countAlerts(ownerId: number, cityIds: number[], departmentIds: number[], from: Date, to: Date): Promise<number> {
  if (cityIds.length === 0 && departmentIds.length === 0) return 0
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentAlerts)
    .where(
      and(
        or(
          cityIds.length > 0 ? inArray(studentAlerts.cityId, cityIds) : undefined,
          departmentIds.length > 0 ? inArray(studentAlerts.departmentId, departmentIds) : undefined,
        ),
        between(studentAlerts.createdAt, from, to),
      ),
    )
  return rows[0]?.count ?? 0
}

async function countFavorites(ownerId: number, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(favoriteAccommodations)
    .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
    .where(and(eq(accommodations.ownerId, ownerId), between(favoriteAccommodations.createdAt, from, to)))
  return rows[0]?.count ?? 0
}

async function countConsultOffer(ownerId: number, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trackingEvents)
    .where(
      and(eq(trackingEvents.type, TYPE_CONSULT_OFFER), eq(trackingEvents.ownerId, ownerId), between(trackingEvents.createdAt, from, to)),
    )
  return rows[0]?.count ?? 0
}

export const ownerStatisticsRouter = createTRPCRouter({
  overview: ownerProcedure.input(periodInput).query(async ({ ctx, input }) => {
    const owner = await resolveOwnerOrThrow(ctx.session.user.id, input.ownerId)
    const { from, to } = getDateRange(input.period)
    const { from: prevFrom, to: prevTo } = getPreviousDateRange(input.period)
    const { cityIds, departmentIds } = await getOwnerTerritories(owner.id)

    const [searchCityRow, searchDeptRow, alertsRow, favoritesRow, viewsRow, consultRow, prevAlerts, prevFavorites, prevConsultOffer] =
      await Promise.all([
        cityIds.length === 0
          ? Promise.resolve([{ count: 0 }])
          : db
              .select({ count: sql<number>`count(*)::int` })
              .from(trackingEvents)
              .where(
                and(
                  eq(trackingEvents.type, TYPE_SEARCH_CITY),
                  inArray(trackingEvents.cityId, cityIds),
                  between(trackingEvents.createdAt, from, to),
                ),
              ),
        departmentIds.length === 0
          ? Promise.resolve([{ count: 0 }])
          : db
              .select({ count: sql<number>`count(*)::int` })
              .from(trackingEvents)
              .where(
                and(
                  eq(trackingEvents.type, TYPE_SEARCH_DEPARTMENT),
                  inArray(trackingEvents.departmentId, departmentIds),
                  between(trackingEvents.createdAt, from, to),
                ),
              ),
        countAlerts(owner.id, cityIds, departmentIds, from, to),
        countFavorites(owner.id, from, to),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(trackingEvents)
          .where(
            and(eq(trackingEvents.type, TYPE_VIEWED), eq(trackingEvents.ownerId, owner.id), between(trackingEvents.createdAt, from, to)),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(trackingEvents)
          .where(
            and(
              eq(trackingEvents.type, TYPE_CONSULT_OFFER),
              eq(trackingEvents.ownerId, owner.id),
              between(trackingEvents.createdAt, from, to),
            ),
          ),
        countAlerts(owner.id, cityIds, departmentIds, prevFrom, prevTo),
        countFavorites(owner.id, prevFrom, prevTo),
        countConsultOffer(owner.id, prevFrom, prevTo),
      ])

    const nbAlerts = alertsRow
    const nbFavorites = favoritesRow
    const nbConsultOffer = consultRow[0]?.count ?? 0

    return {
      ownerId: owner.id,
      period: input.period,
      from: from.toISOString(),
      to: to.toISOString(),
      nbSearchesDepartment: searchDeptRow[0]?.count ?? 0,
      nbSearchesCity: searchCityRow[0]?.count ?? 0,
      nbAlerts,
      nbFavorites,
      nbViews: viewsRow[0]?.count ?? 0,
      nbConsultOffer,
      deltaAlerts: computeDelta(nbAlerts, prevAlerts),
      deltaFavorites: computeDelta(nbFavorites, prevFavorites),
      deltaConsultOffer: computeDelta(nbConsultOffer, prevConsultOffer),
    }
  }),

  trendByDay: ownerProcedure.input(periodInput).query(async ({ ctx, input }) => {
    const owner = await resolveOwnerOrThrow(ctx.session.user.id, input.ownerId)
    const { from, to, days } = getDateRange(input.period)
    const { cityIds, departmentIds } = await getOwnerTerritories(owner.id)

    const dayKey = sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`

    const [searchByDay, alertsByDay, favoritesByDay, viewsByDay, consultByDay] = await Promise.all([
      cityIds.length === 0 && departmentIds.length === 0
        ? Promise.resolve<{ date: string; count: number }[]>([])
        : db
            .select({ date: dayKey.as('date'), count: sql<number>`count(*)::int` })
            .from(trackingEvents)
            .where(
              and(
                or(
                  cityIds.length > 0 ? and(eq(trackingEvents.type, TYPE_SEARCH_CITY), inArray(trackingEvents.cityId, cityIds)) : undefined,
                  departmentIds.length > 0
                    ? and(eq(trackingEvents.type, TYPE_SEARCH_DEPARTMENT), inArray(trackingEvents.departmentId, departmentIds))
                    : undefined,
                ),
                between(trackingEvents.createdAt, from, to),
              ),
            )
            .groupBy(dayKey),
      cityIds.length === 0 && departmentIds.length === 0
        ? Promise.resolve<{ date: string; count: number }[]>([])
        : db
            .select({
              date: sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`.as('date'),
              count: sql<number>`count(*)::int`,
            })
            .from(studentAlerts)
            .where(
              and(
                or(
                  cityIds.length > 0 ? inArray(studentAlerts.cityId, cityIds) : undefined,
                  departmentIds.length > 0 ? inArray(studentAlerts.departmentId, departmentIds) : undefined,
                ),
                between(studentAlerts.createdAt, from, to),
              ),
            )
            .groupBy(sql`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${favoriteAccommodations.createdAt}), 'YYYY-MM-DD')`.as('date'),
          count: sql<number>`count(*)::int`,
        })
        .from(favoriteAccommodations)
        .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
        .where(and(eq(accommodations.ownerId, owner.id), between(favoriteAccommodations.createdAt, from, to)))
        .groupBy(sql`to_char(date_trunc('day', ${favoriteAccommodations.createdAt}), 'YYYY-MM-DD')`),
      db
        .select({ date: dayKey.as('date'), count: sql<number>`count(*)::int` })
        .from(trackingEvents)
        .where(and(eq(trackingEvents.type, TYPE_VIEWED), eq(trackingEvents.ownerId, owner.id), between(trackingEvents.createdAt, from, to)))
        .groupBy(dayKey),
      db
        .select({ date: dayKey.as('date'), count: sql<number>`count(*)::int` })
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.type, TYPE_CONSULT_OFFER),
            eq(trackingEvents.ownerId, owner.id),
            between(trackingEvents.createdAt, from, to),
          ),
        )
        .groupBy(dayKey),
    ])

    const series = new Map<
      string,
      { date: string; nbSearches: number; nbAlerts: number; nbFavorites: number; nbViews: number; nbConsultOffer: number }
    >()

    for (let i = 0; i <= days; i += 1) {
      const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      series.set(key, { date: key, nbSearches: 0, nbAlerts: 0, nbFavorites: 0, nbViews: 0, nbConsultOffer: 0 })
    }

    const merge = (
      rows: { date: string; count: number }[],
      field: 'nbSearches' | 'nbAlerts' | 'nbFavorites' | 'nbViews' | 'nbConsultOffer',
    ) => {
      for (const row of rows) {
        const entry = series.get(row.date)
        if (entry) entry[field] = row.count
      }
    }

    merge(searchByDay, 'nbSearches')
    merge(alertsByDay, 'nbAlerts')
    merge(favoritesByDay, 'nbFavorites')
    merge(viewsByDay, 'nbViews')
    merge(consultByDay, 'nbConsultOffer')

    return Array.from(series.values()).sort((a, b) => a.date.localeCompare(b.date))
  }),

  byAccommodation: ownerProcedure.input(paginatedInput).query(async ({ ctx, input }) => {
    const owner = await resolveOwnerOrThrow(ctx.session.user.id, input.ownerId)
    const { from, to } = getDateRange(input.period)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    const search = input.search.trim()
    const conditions = [eq(accommodations.ownerId, owner.id)]
    if (search) {
      conditions.push(sql`immutable_unaccent(${accommodations.name}) ILIKE immutable_unaccent(${`%${search}%`})`)
    }
    const where = and(...conditions)
    const offset = (input.page - 1) * ACCOMMODATIONS_PAGE_SIZE

    const searchSql = search ? sql`AND immutable_unaccent(a.name) ILIKE immutable_unaccent(${`%${search}%`})` : sql``

    const [[{ count: total = 0 } = { count: 0 }], items] = await Promise.all([
      withQueryLogging('byAccommodation:count', () => db.select({ count: sql<number>`count(*)::int` }).from(accommodations).where(where)),
      withQueryLogging('byAccommodation:items', () =>
        db.execute<{
          accommodationId: number
          name: string
          slug: string
          published: boolean
          postalCode: string | null
          cityName: string | null
          nbViews: number
          nbConsultOffer: number
          nbFavorites: number
        }>(sql`
          SELECT
            a.id::int AS "accommodationId",
            a.name AS "name",
            a.slug AS "slug",
            a.published AS "published",
            addr.postal_code AS "postalCode",
            c.name AS "cityName",
            (
              SELECT count(*)::int FROM tracking_event te
              WHERE te.accommodation_id = a.id
                AND te.type = ${TYPE_VIEWED}
                AND te.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
            ) AS "nbViews",
            (
              SELECT count(*)::int FROM tracking_event te
              WHERE te.accommodation_id = a.id
                AND te.type = ${TYPE_CONSULT_OFFER}
                AND te.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
            ) AS "nbConsultOffer",
            (
              SELECT count(*)::int FROM accommodation_favoriteaccommodation fa
              WHERE fa.accommodation_id = a.id
                AND fa.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
            ) AS "nbFavorites"
          FROM accommodation_accommodation a
          LEFT JOIN accommodation_address addr
            ON addr.accommodation_id = a.id AND addr.is_main = true
          LEFT JOIN territories_city c ON c.id = addr.city_id
          WHERE a.owner_id = ${owner.id}
          ${searchSql}
          ORDER BY a.name
          LIMIT ${ACCOMMODATIONS_PAGE_SIZE}
          OFFSET ${offset}
        `),
      ),
    ])

    return { items, total, pageSize: ACCOMMODATIONS_PAGE_SIZE }
  }),

  byCity: ownerProcedure.input(paginatedInput).query(async ({ ctx, input }) => {
    const owner = await resolveOwnerOrThrow(ctx.session.user.id, input.ownerId)
    const { from, to } = getDateRange(input.period)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()
    const { cityIds } = await getOwnerTerritories(owner.id)

    if (cityIds.length === 0) return { items: [], total: 0, pageSize: CITIES_PAGE_SIZE }

    const search = input.search.trim()
    const cityConditions = [inArray(cities.id, cityIds)]
    if (search) {
      cityConditions.push(sql`immutable_unaccent(${cities.name}) ILIKE immutable_unaccent(${`%${search}%`})`)
    }
    const cityWhere = and(...cityConditions)
    const offset = (input.page - 1) * CITIES_PAGE_SIZE

    const searchSql = search ? sql`AND immutable_unaccent(c.name) ILIKE immutable_unaccent(${`%${search}%`})` : sql``

    const [[{ count: total = 0 } = { count: 0 }], items] = await Promise.all([
      withQueryLogging('byCity:count', () => db.select({ count: sql<number>`count(*)::int` }).from(cities).where(cityWhere)),
      withQueryLogging('byCity:items', () =>
        db.execute<{
          cityId: number
          name: string
          nbSearches: number
          nbAlerts: number
        }>(sql`
          SELECT
            c.id::int AS "cityId",
            c.name AS "name",
            (
              SELECT count(*)::int FROM tracking_event te
              WHERE te.city_id = c.id
                AND te.type = ${TYPE_SEARCH_CITY}
                AND te.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
            ) AS "nbSearches",
            (
              SELECT count(*)::int FROM student_alert sa
              WHERE sa.city_id = c.id
                AND sa.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
            ) AS "nbAlerts"
          FROM territories_city c
          WHERE c.id IN (${sql.join(cityIds, sql`, `)})
          ${searchSql}
          ORDER BY c.name
          LIMIT ${CITIES_PAGE_SIZE}
          OFFSET ${offset}
        `),
      ),
    ])

    return { items, total, pageSize: CITIES_PAGE_SIZE }
  }),
})
