import { and, eq, inArray } from 'drizzle-orm'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { share, type TMonth } from '~/server/admin-metrics/months'
import { db } from '~/server/db'
import { cities, monthlyMetrics } from '~/server/db/schema'

export type TCityMonthRow = {
  cityId: number
  cityName: string
  month: TMonth
  recherches: number
  disponibles: number | null
  totalRenseigne: number | null
  totalPublie: number | null
  tension: number | null
  couverture: number | null
  residencesOuvertes: number | null
  residencesOuvertesSansContact: number | null
  partSansContact: number | null
}

const CITY_METRICS = [
  EMonthlyMetric.SEARCH_CITY,
  EMonthlyMetric.CITY_AVAILABLE,
  EMonthlyMetric.CITY_KNOWN_TOTAL,
  EMonthlyMetric.CITY_PUBLISHED_TOTAL,
  EMonthlyMetric.CITY_OPEN_RESIDENCES,
  EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT,
]

export const getCityMetrics = async (month: TMonth): Promise<TCityMonthRow[]> => {
  const rows = await db
    .select({ cityId: monthlyMetrics.scopeId, cityName: cities.name, metric: monthlyMetrics.metric, value: monthlyMetrics.value })
    .from(monthlyMetrics)
    .innerJoin(cities, eq(cities.id, monthlyMetrics.scopeId))
    .where(and(eq(monthlyMetrics.month, month), eq(monthlyMetrics.scope, 'city'), inArray(monthlyMetrics.metric, CITY_METRICS)))

  const byCity = new Map<number, { cityName: string; values: Map<string, number> }>()
  for (const row of rows) {
    const entry = byCity.get(row.cityId) ?? { cityName: row.cityName, values: new Map<string, number>() }
    entry.values.set(row.metric, row.value)
    byCity.set(row.cityId, entry)
  }

  return [...byCity.entries()]
    .map(([cityId, { cityName, values }]) => {
      const disponibles = values.get(EMonthlyMetric.CITY_AVAILABLE) ?? null
      const totalRenseigne = values.get(EMonthlyMetric.CITY_KNOWN_TOTAL) ?? null
      const totalPublie = values.get(EMonthlyMetric.CITY_PUBLISHED_TOTAL) ?? null
      const residencesOuvertes = values.get(EMonthlyMetric.CITY_OPEN_RESIDENCES) ?? null
      const residencesOuvertesSansContact = values.get(EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT) ?? null
      return {
        cityId,
        cityName,
        month,
        recherches: values.get(EMonthlyMetric.SEARCH_CITY) ?? 0,
        disponibles,
        totalRenseigne,
        totalPublie,
        tension: share(disponibles, totalRenseigne),
        couverture: share(totalRenseigne, totalPublie),
        residencesOuvertes,
        residencesOuvertesSansContact,
        partSansContact: share(residencesOuvertesSansContact, residencesOuvertes),
      }
    })
    .sort((a, b) => b.recherches - a.recherches)
}
