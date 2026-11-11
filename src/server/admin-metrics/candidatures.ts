import { type AnyColumn, and, gte, lt, sql } from 'drizzle-orm'
import { EMetricItem } from '~/enums/metric-item'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { listMonths, monthOf } from '~/server/admin-metrics/months'
import {
  fillMonths,
  matomoEvents,
  monthBounds,
  snapshotsOf,
  type TMetricSeries,
  type TMonthlyValue,
  type TRow,
} from '~/server/admin-metrics/series'
import { db } from '~/server/db'
import { applicationFacts } from '~/server/db/schema'

export type { TMetricSeries, TMonthlyValue }

const factsBy = async (column: AnyColumn, range: TMonthRange): Promise<TRow[]> => {
  const month = monthOf(column)
  const { start, end } = monthBounds(range)
  return db
    .select({
      month,
      total: sql<number>`count(*)::int`,
      boursiers: sql<number>`count(*) filter (where ${applicationFacts.scholarshipStatus} = 'yes')::int`,
    })
    .from(applicationFacts)
    .where(and(gte(column, start), lt(column, end)))
    .groupBy(month)
}

export const getCandidaturesSeries = async (range: TMonthRange): Promise<TMetricSeries[]> => {
  const months = listMonths(range)
  const [transmis, contactes, attribues, consultBase, consultMatomo, landing] = await Promise.all([
    factsBy(applicationFacts.createdAt, range),
    factsBy(applicationFacts.contactedAt, range),
    factsBy(applicationFacts.attributedAt, range),
    snapshotsOf(EMonthlyMetric.CONSULT_OFFER, range),
    matomoEvents('Logement', 'consulter offre', range),
    snapshotsOf(EMonthlyMetric.OWNER_LANDING_CLICK, range),
  ])

  return [
    { key: EMetricItem.CONTACTS_TRANSMIS, values: fillMonths(months, transmis, 0) },
    { key: EMetricItem.ETUDIANTS_CONTACTES, values: fillMonths(months, contactes, 0) },
    { key: EMetricItem.LOGEMENTS_ATTRIBUES, values: fillMonths(months, attribues, 0) },
    { key: EMetricItem.CONSULT_OFFER_BASE, values: fillMonths(months, consultBase, null, null) },
    { key: EMetricItem.CONSULT_OFFER_MATOMO, values: fillMonths(months, consultMatomo, null) },
    { key: EMetricItem.OWNER_LANDING_CLICK, values: fillMonths(months, landing, null, null) },
  ]
}
