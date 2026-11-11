import { addMonths, format } from 'date-fns'
import { type AnyColumn, and, between, eq, gte, lt, sql } from 'drizzle-orm'
import { EMetricItem } from '~/enums/metric-item'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { listMonths, monthOf, monthStart, type TMonth } from '~/server/admin-metrics/months'
import { db } from '~/server/db'
import { applicationFacts, eventStats, monthlyMetrics } from '~/server/db/schema'

export type TMonthlyValue = { month: TMonth; total: number; boursiers: number | null }
export type TMetricSeries = { key: EMetricItem; values: TMonthlyValue[] }

type TRow = { month: string; total: number; boursiers: number | null }

const fillMonths = (months: TMonth[], rows: TRow[], emptyBoursiers: number | null): TMonthlyValue[] => {
  const byMonth = new Map(rows.map((row) => [row.month, row]))
  return months.map((month) => {
    const row = byMonth.get(month)
    return { month, total: row?.total ?? 0, boursiers: row ? row.boursiers : emptyBoursiers }
  })
}

const factsBy = async (column: AnyColumn, range: TMonthRange): Promise<TRow[]> => {
  const month = monthOf(column)
  const end = monthStart(format(addMonths(new Date(`${range.to}-01T00:00:00`), 1), 'yyyy-MM'))
  return db
    .select({
      month,
      total: sql<number>`count(*)::int`,
      boursiers: sql<number>`count(*) filter (where ${applicationFacts.scholarshipStatus} = 'yes')::int`,
    })
    .from(applicationFacts)
    .where(and(gte(column, monthStart(range.from)), lt(column, end)))
    .groupBy(month)
}

const snapshotsOf = async (metric: EMonthlyMetric, range: TMonthRange): Promise<TRow[]> => {
  const rows = await db
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
  return rows
}

const matomoConsultOffer = async (range: TMonthRange): Promise<TRow[]> => {
  const month = sql<string>`to_char(${eventStats.date}, 'YYYY-MM')`
  return db
    .select({ month, total: sql<number>`coalesce(sum(${eventStats.nbEvents}), 0)::int`, boursiers: sql<number | null>`null` })
    .from(eventStats)
    .where(
      and(
        eq(eventStats.category, 'Logement'),
        eq(eventStats.action, 'consulter offre'),
        sql`${month} between ${range.from} and ${range.to}`,
      ),
    )
    .groupBy(month)
}

export const getCandidaturesSeries = async (range: TMonthRange): Promise<TMetricSeries[]> => {
  const months = listMonths(range)
  const [transmis, contactes, attribues, consultBase, consultMatomo, landing] = await Promise.all([
    factsBy(applicationFacts.createdAt, range),
    factsBy(applicationFacts.contactedAt, range),
    factsBy(applicationFacts.attributedAt, range),
    snapshotsOf(EMonthlyMetric.CONSULT_OFFER, range),
    matomoConsultOffer(range),
    snapshotsOf(EMonthlyMetric.OWNER_LANDING_CLICK, range),
  ])

  return [
    { key: EMetricItem.CONTACTS_TRANSMIS, values: fillMonths(months, transmis, 0) },
    { key: EMetricItem.ETUDIANTS_CONTACTES, values: fillMonths(months, contactes, 0) },
    { key: EMetricItem.LOGEMENTS_ATTRIBUES, values: fillMonths(months, attribues, 0) },
    { key: EMetricItem.CONSULT_OFFER_BASE, values: fillMonths(months, consultBase, null) },
    { key: EMetricItem.CONSULT_OFFER_MATOMO, values: fillMonths(months, consultMatomo, null) },
    { key: EMetricItem.OWNER_LANDING_CLICK, values: fillMonths(months, landing, null) },
  ]
}
