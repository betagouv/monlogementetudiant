import { describe, expect, it } from 'vitest'
import { getCandidaturesSeries } from '~/server/admin-metrics/candidatures'
import { applicationFacts, eventStats, monthlyMetrics } from '~/server/db/schema'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

type TFact = typeof applicationFacts.$inferInsert

const fact = (id: string, overrides: Partial<TFact>): TFact => ({
  id,
  channel: 'contact',
  createdAt: new Date('2026-10-10T10:00:00Z'),
  status: 'a_moderer',
  ...overrides,
})

describe('getCandidaturesSeries', () => {
  it('construit les séries mensuelles avec la part de boursiers', async () => {
    const db = getTestDb()
    await db.insert(applicationFacts).values([
      fact('contact:1', { scholarshipStatus: 'yes' }),
      fact('contact:2', { scholarshipStatus: 'no' }),
      fact('contact:3', { createdAt: new Date('2026-10-31T22:30:00Z') }),
      fact('df:4', {
        channel: 'dossier_facile',
        createdAt: new Date('2026-11-03T10:00:00Z'),
        contactedAt: new Date('2026-11-05T10:00:00Z'),
        scholarshipStatus: 'yes',
      }),
      fact('contact:5', {
        createdAt: new Date('2026-10-12T10:00:00Z'),
        attributedAt: new Date('2026-11-06T10:00:00Z'),
        scholarshipStatus: 'yes',
      }),
    ])
    await db.insert(monthlyMetrics).values([
      { month: '2026-10', metric: 'consult_offer', scope: 'global', scopeId: 0, value: 40, boursiers: 8 },
      { month: '2026-11', metric: 'owner_landing_click', scope: 'global', scopeId: 0, value: 5 },
    ])
    await db.insert(eventStats).values([
      { date: '2026-10-15', category: 'Logement', action: 'consulter offre', nbEvents: 7 },
      { date: '2026-10-20', category: 'Logement', action: 'consulter offre', nbEvents: 3 },
      { date: '2026-10-20', category: 'Logement', action: 'autre', nbEvents: 99 },
    ])

    const series = await getCandidaturesSeries({ from: '2026-10', to: '2026-11' })
    const byKey = Object.fromEntries(series.map((s) => [s.key, s.values]))

    expect(byKey.contacts_transmis).toEqual([
      { month: '2026-10', total: 4, boursiers: 2 },
      { month: '2026-11', total: 1, boursiers: 1 },
    ])
    expect(byKey.etudiants_contactes).toEqual([
      { month: '2026-10', total: 0, boursiers: 0 },
      { month: '2026-11', total: 1, boursiers: 1 },
    ])
    expect(byKey.logements_attribues[1]).toEqual({ month: '2026-11', total: 1, boursiers: 1 })
    expect(byKey.consult_offer_base).toEqual([
      { month: '2026-10', total: 40, boursiers: 8 },
      { month: '2026-11', total: 0, boursiers: null },
    ])
    expect(byKey.consult_offer_matomo).toEqual([
      { month: '2026-10', total: 10, boursiers: null },
      { month: '2026-11', total: 0, boursiers: null },
    ])
    expect(byKey.owner_landing_click).toEqual([
      { month: '2026-10', total: 0, boursiers: null },
      { month: '2026-11', total: 5, boursiers: null },
    ])
  })
})
