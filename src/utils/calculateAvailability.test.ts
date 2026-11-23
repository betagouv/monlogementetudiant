import { describe, expect, it } from 'vitest'
import type { TTypologiesRecord } from '~/schemas/accommodations/accommodations'
import { calculateAvailability, publicAvailability } from './calculateAvailability'

// Minimal typology view (only nbAvailable matters for availability).
const mk = (nbAvailable: number | null): TTypologiesRecord[keyof TTypologiesRecord] => ({
  priceMin: null,
  priceMax: null,
  superficieMin: null,
  superficieMax: null,
  nbTotal: 10,
  nbAvailable,
  colocation: false,
})

describe('calculateAvailability', () => {
  it('returns null when there are no typologies', () => {
    expect(calculateAvailability({})).toBeNull()
  })

  it('returns null when every typology availability is null', () => {
    expect(calculateAvailability({ t1: mk(null), t2: mk(null) })).toBeNull()
  })

  it('sums non-null availabilities across typologies', () => {
    expect(calculateAvailability({ t1: mk(3), t2: mk(2) })).toBe(5)
  })

  it('treats 0 availability as a known value (sums to 0)', () => {
    expect(calculateAvailability({ t1: mk(0), t2: mk(0) })).toBe(0)
  })

  it('ignores typologies with null availability when summing', () => {
    expect(calculateAvailability({ t1: mk(5), t2: mk(null) })).toBe(5)
  })
})

describe('publicAvailability', () => {
  it('masque les disponibilités d’une résidence Crous', () => {
    expect(publicAvailability({ isCrous: true, typologies: { t1: mk(3) } })).toBeNull()
  })

  it('affiche celles des autres résidences', () => {
    expect(publicAvailability({ isCrous: false, typologies: { t1: mk(3) } })).toBe(3)
    expect(publicAvailability({ typologies: { t1: mk(0) } })).toBe(0)
  })
})
