import { describe, expect, it } from 'vitest'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { getCityMetrics } from '~/server/admin-metrics/territories'
import { monthlyMetrics } from '~/server/db/schema'
import { createAcademy, createCity, createDepartment } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const seed = async (cityId: number, metric: EMonthlyMetric, value: number, month = '2026-11') => {
  await getTestDb().insert(monthlyMetrics).values({ month, metric, scope: 'city', scopeId: cityId, value })
}

const setup = async () => {
  const academy = await createAcademy()
  const department = await createDepartment({ academyId: academy.id, name: 'Loire', code: '42' })
  const x = await createCity({ departmentId: department.id, name: 'Ville X', slug: 'ville-x' })
  const y = await createCity({ departmentId: department.id, name: 'Ville Y', slug: 'ville-y' })
  const z = await createCity({ departmentId: department.id, name: 'Ville Z', slug: 'ville-z' })
  return { x, y, z }
}

describe('métriques par ville', () => {
  it('calcule tension, couverture et part sans contact', async () => {
    const { x, y, z } = await setup()
    await seed(x.id, EMonthlyMetric.SEARCH_CITY, 7)
    await seed(x.id, EMonthlyMetric.CITY_AVAILABLE, 2)
    await seed(x.id, EMonthlyMetric.CITY_KNOWN_TOTAL, 10)
    await seed(x.id, EMonthlyMetric.CITY_PUBLISHED_TOTAL, 40)
    await seed(x.id, EMonthlyMetric.CITY_OPEN_RESIDENCES, 1)
    await seed(x.id, EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT, 1)
    await seed(y.id, EMonthlyMetric.SEARCH_CITY, 20)
    await seed(y.id, EMonthlyMetric.CITY_AVAILABLE, 0)
    await seed(y.id, EMonthlyMetric.CITY_KNOWN_TOTAL, 0)
    await seed(y.id, EMonthlyMetric.CITY_PUBLISHED_TOTAL, 30)
    await seed(y.id, EMonthlyMetric.CITY_OPEN_RESIDENCES, 0)
    await seed(y.id, EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT, 0)
    await seed(z.id, EMonthlyMetric.SEARCH_CITY, 3, '2026-10')

    const rows = await getCityMetrics('2026-11')

    expect(rows).toEqual([
      {
        cityId: y.id,
        cityName: 'Ville Y',
        month: '2026-11',
        recherches: 20,
        disponibles: 0,
        totalRenseigne: 0,
        totalPublie: 30,
        tension: null,
        couverture: 0,
        residencesOuvertes: 0,
        residencesOuvertesSansContact: 0,
        partSansContact: null,
      },
      {
        cityId: x.id,
        cityName: 'Ville X',
        month: '2026-11',
        recherches: 7,
        disponibles: 2,
        totalRenseigne: 10,
        totalPublie: 40,
        tension: 0.2,
        couverture: 0.25,
        residencesOuvertes: 1,
        residencesOuvertesSansContact: 1,
        partSansContact: 1,
      },
    ])
  })

  it('laisse null les états absents, compte 0 recherche et ignore une ville supprimée', async () => {
    const { x } = await setup()
    await seed(x.id, EMonthlyMetric.CITY_PUBLISHED_TOTAL, 5)
    await seed(999999, EMonthlyMetric.SEARCH_CITY, 4)

    const rows = await getCityMetrics('2026-11')

    expect(rows).toEqual([
      expect.objectContaining({ cityId: x.id, recherches: 0, disponibles: null, tension: null, couverture: null, partSansContact: null }),
    ])
  })
})
