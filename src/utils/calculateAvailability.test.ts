import { describe, expect, it } from 'vitest'
import { calculateAvailability } from './calculateAvailability'

const allNull = {
  nb_t1_available: null,
  nb_t1_bis_available: null,
  nb_t2_available: null,
  nb_t3_available: null,
  nb_t4_available: null,
  nb_t5_available: null,
  nb_t6_available: null,
  nb_t7_more_available: null,
}

const noStock = {
  nb_t1: null,
  nb_t1_bis: null,
  nb_t2: null,
  nb_t3: null,
  nb_t4: null,
  nb_t5: null,
  nb_t6: null,
  nb_t7_more: null,
}

describe('calculateAvailability', () => {
  it('returns null when all availability values are null (no stock provided)', () => {
    expect(calculateAvailability(allNull)).toBeNull()
  })

  it('sums non-null values when no stock provided', () => {
    expect(calculateAvailability({ ...allNull, nb_t1_available: 3, nb_t2_available: 2 })).toBe(5)
  })

  it('returns 0 when all non-null values are 0 (no stock provided)', () => {
    expect(calculateAvailability({ ...allNull, nb_t1_available: 0 })).toBe(0)
  })

  it('returns null when all availability values are null and stock is provided', () => {
    const stock = { ...noStock, nb_t1: 10, nb_t2: 5 }
    expect(calculateAvailability(allNull, stock)).toBeNull()
  })

  it('returns null when typologies with stock have null availability (others have 0)', () => {
    // nb_t3 has stock=10, availability=null → relevant and null
    // nb_t1 has stock=null, availability=0 → not relevant (no stock)
    const availability = { ...allNull, nb_t1_available: 0, nb_t2_available: 0 }
    const stock = { ...noStock, nb_t3: 10 }
    expect(calculateAvailability(availability, stock)).toBeNull()
  })

  it('sums availability only for typologies with stock', () => {
    const availability = { ...allNull, nb_t1_available: 3, nb_t2_available: 2, nb_t3_available: 0 }
    const stock = { ...noStock, nb_t1: 10, nb_t2: 5 }
    // nb_t3 has no stock → ignored, only t1 (3) + t2 (2) = 5
    expect(calculateAvailability(availability, stock)).toBe(5)
  })

  it('returns 0 when all typologies with stock have availability=0', () => {
    const availability = { ...allNull, nb_t1_available: 0, nb_t2_available: 0 }
    const stock = { ...noStock, nb_t1: 10, nb_t2: 5 }
    expect(calculateAvailability(availability, stock)).toBe(0)
  })

  it('ignores typologies with stock=0', () => {
    const availability = { ...allNull, nb_t1_available: null }
    const stock = { ...noStock, nb_t1: 0 }
    expect(calculateAvailability(availability, stock)).toBeNull()
  })

  it('handles mixed: some typologies with stock filled, some not', () => {
    // t1: stock=10, available=5 → counted
    // t2: stock=5, available=null → relevant but null
    const availability = { ...allNull, nb_t1_available: 5 }
    const stock = { ...noStock, nb_t1: 10, nb_t2: 5 }
    // t2 has stock but null availability → only t1 is non-null → sum = 5
    expect(calculateAvailability(availability, stock)).toBe(5)
  })

  it('returns null when stock is provided but all stock values are null or 0', () => {
    const availability = { ...allNull, nb_t1_available: 0 }
    const stock = noStock
    // No typology has stock → relevant list is empty → null
    expect(calculateAvailability(availability, stock)).toBeNull()
  })
})
