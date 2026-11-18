import { describe, expect, it } from 'vitest'
import { contactStatsShare } from './contact-stats-share'

describe('contactStatsShare', () => {
  it('arrondit la part à l’entier le plus proche', () => {
    expect(contactStatsShare(1, 3)).toBe(33)
    expect(contactStatsShare(2, 3)).toBe(67)
    expect(contactStatsShare(3, 3)).toBe(100)
  })

  it('renvoie null sans demande reçue', () => {
    expect(contactStatsShare(0, 0)).toBeNull()
  })
})
