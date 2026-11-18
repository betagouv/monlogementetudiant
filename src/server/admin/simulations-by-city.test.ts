import { describe, expect, it } from 'vitest'
import type { HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { cityKey, groupSimulationsByCity, summarizeByStatus } from './simulations-by-city'

const sim = (userId: string, city: string, overrides: Partial<HelpSimulatorFormData> = {}) => ({
  userId,
  inputs: {
    age: 20,
    status: ['student'],
    monthlyIncome: 500,
    monthlyRent: 400,
    city,
    hasGuarantor: 'yes',
    ...overrides,
  } as HelpSimulatorFormData,
})

describe('cityKey', () => {
  it('rapproche les variantes de saisie', () => {
    expect(cityKey('Saint-Étienne')).toBe(cityKey(' ST ETIENNE '))
    expect(cityKey('saint etienne')).toBe('saint etienne')
  })
})

describe('summarizeByStatus', () => {
  it('compte une simulation multi-statut dans chaque ligne et ignore les statuts absents', () => {
    const rows = summarizeByStatus([sim('a', 'Lyon', { status: ['student', 'boursier-crous'] }), sim('b', 'Lyon')])
    expect(rows.map((r) => [r.status, r.simulations])).toEqual([
      ['student', 2],
      ['boursier-crous', 1],
    ])
  })
})

describe('groupSimulationsByCity', () => {
  it('compte toutes les versions et dédoublonne les étudiants', () => {
    const [lyon] = groupSimulationsByCity(
      [sim('a', 'Lyon'), sim('a', 'lyon', { monthlyIncome: 700, hasGuarantor: 'no' }), sim('b', 'Lyon ')],
      [{ name: 'Lyon', popular: true }],
    )
    expect(lyon).toMatchObject({
      key: 'lyon',
      city: 'Lyon',
      isUniversityCity: true,
      simulations: 3,
      students: 2,
      averageIncome: 567,
      averageRent: 400,
      guarantorRate: 67,
    })
    expect(lyon.byStatus).toEqual([expect.objectContaining({ status: 'student', simulations: 3, students: 2 })])
  })

  it('reprend l’orthographe la plus fréquente pour une ville hors référentiel', () => {
    const [pau] = groupSimulationsByCity([sim('a', 'Pau'), sim('b', 'PAU'), sim('c', 'Pau')], [])
    expect(pau).toMatchObject({ city: 'Pau', isUniversityCity: false })
  })

  it('préfère une orthographe bien écrite, sinon remet en forme', () => {
    const [dijon] = groupSimulationsByCity([sim('a', 'dijon'), sim('b', 'dijon'), sim('c', 'Dijon')], [])
    expect(dijon.city).toBe('Dijon')
    const [larochelle] = groupSimulationsByCity([sim('a', 'LA ROCHELLE'), sim('b', 'la rochelle')], [])
    expect(larochelle.city).toBe('La Rochelle')
  })

  it('trie par nombre de simulations puis par nom, et ignore les loyers non renseignés', () => {
    const rows = groupSimulationsByCity(
      [sim('a', 'Pau'), sim('b', 'Lyon'), sim('c', 'Lyon'), sim('d', 'Brest', { monthlyRent: Number.NaN })],
      [],
    )
    expect(rows.map((r) => r.city)).toEqual(['Lyon', 'Brest', 'Pau'])
    expect(rows[1].averageRent).toBeNull()
  })

  it('ignore les villes vides', () => {
    expect(groupSimulationsByCity([sim('a', '  ')], [])).toEqual([])
  })
})
