import { describe, expect, it } from 'vitest'
import { nextRunAt } from './next-run'

describe('nextRunAt', () => {
  it('passe à la plage horaire du lendemain', () => {
    expect(nextRunAt('*/30 5-19 * * *', new Date('2026-11-14T19:45:00Z')).toISOString()).toBe('2026-11-15T05:00:00.000Z')
  })

  it('gère un pas trimestriel sur le mois', () => {
    expect(nextRunAt('0 4 1 */3 *', new Date('2026-11-14T00:00:00Z')).toISOString()).toBe('2027-01-01T04:00:00.000Z')
  })

  it('exclut l’instant de départ lui-même', () => {
    expect(nextRunAt('0 2 * * *', new Date('2026-11-14T02:00:00Z')).toISOString()).toBe('2026-11-15T02:00:00.000Z')
  })
})
