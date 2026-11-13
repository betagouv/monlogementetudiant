import { addMonths, format } from 'date-fns'
import { type AnyColumn, and, between, eq, gte, lt, type SQL, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { EMetricItem } from '~/enums/metric-item'
import type { EMonthlyMetric } from '~/enums/monthly-metric'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { monthOf, monthStart, type TMonth } from '~/server/admin-metrics/months'
import { db } from '~/server/db'
import { eventStats, monthlyMetrics, user } from '~/server/db/schema'

export type TMonthlyValue = { month: TMonth; total: number | null; boursiers: number | null }

export type TMetricSeries = { key: EMetricItem; values: TMonthlyValue[] }

export type TRow = { month: string; total: number | null; boursiers: number | null }

export const fillMonths = (
  months: TMonth[],
  rows: TRow[],
  emptyBoursiers: number | null,
  emptyTotal: number | null = 0,
): TMonthlyValue[] => {
  const byMonth = new Map(rows.map((row) => [row.month, row]))
  return months.map((month) => {
    const row = byMonth.get(month)
    return { month, total: row ? row.total : emptyTotal, boursiers: row ? row.boursiers : emptyBoursiers }
  })
}

export const monthBounds = (range: TMonthRange) => ({
  start: monthStart(range.from),
  end: monthStart(format(addMonths(new Date(`${range.to}-01T00:00:00`), 1), 'yyyy-MM')),
})

export const snapshotsOf = async (metric: EMonthlyMetric, range: TMonthRange): Promise<TRow[]> =>
  db
    .select({ month: monthlyMetrics.month, total: monthlyMetrics.value, boursiers: monthlyMetrics.boursiers })
    .from(monthlyMetrics)
    .where(
      and(
        eq(monthlyMetrics.metric, metric),
        eq(monthlyMetrics.scope, 'global'),
        eq(monthlyMetrics.scopeId, 0),
        between(monthlyMetrics.month, range.from, range.to),
      ),
    )

export const matomoEvents = async (category: string, action: string, range: TMonthRange): Promise<TRow[]> => {
  const month = sql<string>`to_char(${eventStats.date}, 'YYYY-MM')`
  return db
    .select({ month, total: sql<number>`coalesce(sum(${eventStats.nbEvents}), 0)::int`, boursiers: sql<number | null>`null` })
    .from(eventStats)
    .where(and(eq(eventStats.category, category), eq(eventStats.action, action), sql`${month} between ${range.from} and ${range.to}`))
    .groupBy(month)
}

export const usersBy = async (table: PgTable, column: AnyColumn, userId: AnyColumn, range: TMonthRange, extra?: SQL): Promise<TRow[]> => {
  const month = monthOf(column)
  const { start, end } = monthBounds(range)
  const query = db
    .select({
      month,
      total: sql<number>`count(*)::int`,
      boursiers: sql<number>`count(*) filter (where ${user.scholarshipStatus} = 'yes')::int`,
    })
    .from(table)
    .$dynamic()
  const joined = table === user ? query : query.innerJoin(user, eq(user.id, userId))
  return joined.where(and(gte(column, start), lt(column, end), extra)).groupBy(month)
}
