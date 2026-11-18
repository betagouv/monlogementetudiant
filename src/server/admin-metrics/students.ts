import { eq } from 'drizzle-orm'
import { EMetricItem } from '~/enums/metric-item'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { listMonths } from '~/server/admin-metrics/months'
import {
  fillMonths,
  matomoEvents,
  snapshotsOf,
  type TMetricSeries,
  type TMonthlyValue,
  type TRow,
  usersBy,
} from '~/server/admin-metrics/series'
import { budgetSimulations, favoriteAccommodations, housingAidSimulations, studentAlerts, user } from '~/server/db/schema'

const ALERT_ITEMS = [
  [EMetricItem.ALERT_EMAILS_SENT, EMonthlyMetric.ALERT_EMAILS_SENT],
  [EMetricItem.ALERT_HOUSINGS_ALERT, EMonthlyMetric.ALERT_HOUSINGS_ALERT],
  [EMetricItem.ALERT_HOUSINGS_FAVORITE, EMonthlyMetric.ALERT_HOUSINGS_FAVORITE],
  [EMetricItem.ALERT_HOUSINGS_SIMILAR, EMonthlyMetric.ALERT_HOUSINGS_SIMILAR],
  [EMetricItem.ALERT_STUDENTS_NOTIFIED, EMonthlyMetric.ALERT_STUDENTS_NOTIFIED],
  [EMetricItem.ALERT_EMAILS_FAILED, EMonthlyMetric.ALERT_EMAILS_FAILED],
] as const

const HOUSING_METRICS = [EMonthlyMetric.ALERT_HOUSINGS_ALERT, EMonthlyMetric.ALERT_HOUSINGS_FAVORITE, EMonthlyMetric.ALERT_HOUSINGS_SIMILAR]

const alertSeries = (months: string[], snapshots: Map<EMonthlyMetric, TRow[]>): TMetricSeries[] => {
  const rowsOf = (metric: EMonthlyMetric) => snapshots.get(metric) ?? []
  const captured = new Set([...snapshots.values()].flat().map((row) => row.month))
  const withHousings = new Set(HOUSING_METRICS.flatMap(rowsOf).map((row) => row.month))
  const emails = rowsOf(EMonthlyMetric.ALERT_EMAILS_SENT)
  const withEmails = new Set(emails.map((row) => row.month))
  const emailValues = fillMonths(months, emails, null)

  return ALERT_ITEMS.map(([key, metric]): TMetricSeries => {
    if (metric === EMonthlyMetric.ALERT_EMAILS_SENT) {
      const values = emailValues.map(
        (value): TMonthlyValue => ({
          ...value,
          total: withEmails.has(value.month) || !withHousings.has(value.month) ? (value.total ?? 0) : null,
        }),
      )
      return { key, values }
    }
    const values = fillMonths(months, rowsOf(metric), null, null).map(
      (value): TMonthlyValue => ({ ...value, total: captured.has(value.month) ? (value.total ?? 0) : null }),
    )
    return { key, values }
  })
}

export const getStudentSeries = async (range: TMonthRange): Promise<TMetricSeries[]> => {
  const months = listMonths(range)
  const [accounts, alerts, alertsMatomo, favorites, favoritesMatomo, aids, aidsMatomo, budgets, budgetsMatomo, totals] = await Promise.all([
    usersBy(user, user.createdAt, user.id, range, eq(user.role, 'user')),
    usersBy(studentAlerts, studentAlerts.createdAt, studentAlerts.userId, range),
    matomoEvents('Alertes', 'creation alerte', range),
    usersBy(favoriteAccommodations, favoriteAccommodations.createdAt, favoriteAccommodations.userId, range),
    matomoEvents('Favoris', 'ajout favori', range),
    usersBy(housingAidSimulations, housingAidSimulations.createdAt, housingAidSimulations.userId, range),
    matomoEvents('Simulateur', 'completion simulateur aides', range),
    usersBy(budgetSimulations, budgetSimulations.createdAt, budgetSimulations.userId, range),
    matomoEvents('Simulateur', 'completion simulateur budget', range),
    snapshotsOf(EMonthlyMetric.STUDENTS_TOTAL, range),
  ])
  const alertSnapshots = new Map(
    await Promise.all(ALERT_ITEMS.map(async ([, metric]) => [metric, await snapshotsOf(metric, range)] as const)),
  )

  return [
    { key: EMetricItem.COMPTES_CREES, values: fillMonths(months, accounts, 0) },
    { key: EMetricItem.ALERTES_BASE, values: fillMonths(months, alerts, 0) },
    { key: EMetricItem.ALERTES_MATOMO, values: fillMonths(months, alertsMatomo, null) },
    { key: EMetricItem.FAVORIS_BASE, values: fillMonths(months, favorites, 0) },
    { key: EMetricItem.FAVORIS_MATOMO, values: fillMonths(months, favoritesMatomo, null) },
    { key: EMetricItem.SIMULATIONS_AIDES_BASE, values: fillMonths(months, aids, 0) },
    { key: EMetricItem.SIMULATIONS_AIDES_MATOMO, values: fillMonths(months, aidsMatomo, null) },
    { key: EMetricItem.SIMULATIONS_BUDGET_BASE, values: fillMonths(months, budgets, 0) },
    { key: EMetricItem.SIMULATIONS_BUDGET_MATOMO, values: fillMonths(months, budgetsMatomo, null) },
    { key: EMetricItem.ETUDIANTS_BOURSIERS, values: fillMonths(months, totals, null, null) },
    ...alertSeries(months, alertSnapshots),
  ]
}
