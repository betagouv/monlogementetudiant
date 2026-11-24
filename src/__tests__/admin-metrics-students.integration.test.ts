import { describe, expect, it } from 'vitest'
import { getStudentSeries } from '~/server/admin-metrics/students'
import { eventStats, housingAidSimulations, monthlyMetrics, studentAlerts } from '~/server/db/schema'
import { createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const RANGE = { from: '2026-10', to: '2026-11' }

const byKey = async () => {
  const series = await getStudentSeries(RANGE)
  return Object.fromEntries(series.map((s) => [s.key, s.values]))
}

describe('getStudentSeries', () => {
  it('compte les comptes créés avec la part de boursiers, en heure de Paris', async () => {
    await createUser({ id: 'a', scholarshipStatus: 'yes', createdAt: new Date('2026-10-10T10:00:00Z') })
    await createUser({ id: 'b', scholarshipStatus: 'no', createdAt: new Date('2026-10-31T22:30:00Z') })
    await createUser({ id: 'c', createdAt: new Date('2026-11-01T10:00:00Z') })
    await createUser({ id: 'owner', role: 'owner', createdAt: new Date('2026-10-10T10:00:00Z') })

    const series = await byKey()

    expect(series.comptes_crees).toEqual([
      { month: '2026-10', total: 2, boursiers: 1 },
      { month: '2026-11', total: 1, boursiers: 0 },
    ])
  })

  it('lit les alertes et simulations en base et les événements Matomo', async () => {
    const db = getTestDb()
    await createUser({ id: 'a', scholarshipStatus: 'yes' })
    await db.insert(studentAlerts).values([
      { userId: 'a', name: 'Alerte', maxPrice: 500, createdAt: new Date('2026-10-12T10:00:00Z') },
      { userId: 'a', name: 'Alerte 2', maxPrice: 600, createdAt: new Date('2026-11-12T10:00:00Z') },
    ])
    await db.insert(housingAidSimulations).values({
      userId: 'a',
      inputs: {} as never,
      createdAt: new Date('2026-11-02T10:00:00Z'),
    })
    await db.insert(eventStats).values([
      { date: '2026-10-15', category: 'Alertes', action: 'creation alerte', nbEvents: 1 },
      { date: '2026-10-16', category: 'Alertes', action: 'creation alerte', nbEvents: 2 },
      { date: '2026-10-16', category: 'Alertes', action: 'autre', nbEvents: 50 },
    ])

    const series = await byKey()

    expect(series.alertes_base).toEqual([
      { month: '2026-10', total: 1, boursiers: 1 },
      { month: '2026-11', total: 1, boursiers: 1 },
    ])
    expect(series.alertes_matomo).toEqual([
      { month: '2026-10', total: 3, boursiers: null },
      { month: '2026-11', total: 0, boursiers: null },
    ])
    expect(series.simulations_aides_base[1]).toEqual({ month: '2026-11', total: 1, boursiers: 1 })
    expect(series.simulations_budget_base[0]).toEqual({ month: '2026-10', total: 0, boursiers: 0 })
  })

  it('lit le relevé du nombre total d étudiants', async () => {
    await getTestDb()
      .insert(monthlyMetrics)
      .values({ month: '2026-11', metric: 'students_total', scope: 'global', scopeId: 0, value: 40, boursiers: 12 })

    const series = await byKey()

    expect(series.etudiants_boursiers).toEqual([
      { month: '2026-10', total: null, boursiers: null },
      { month: '2026-11', total: 40, boursiers: 12 },
    ])
  })
})
