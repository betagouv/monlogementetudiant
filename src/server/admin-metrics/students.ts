import { eq } from 'drizzle-orm'
import { EMetricItem } from '~/enums/metric-item'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { listMonths } from '~/server/admin-metrics/months'
import { fillMonths, matomoEvents, snapshotsOf, type TMetricSeries, usersBy } from '~/server/admin-metrics/series'
import { budgetSimulations, favoriteAccommodations, housingAidSimulations, studentAlerts, user } from '~/server/db/schema'

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
  ]
}
