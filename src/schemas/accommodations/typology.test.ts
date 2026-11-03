import { describe, expect, it } from 'vitest'
import { ZTypologies, ZTypology } from './typology'

const valid = {
  type: 't1' as const,
  priceMin: 400,
  priceMax: 600,
  superficieMin: 15,
  superficieMax: 25,
  colocation: false,
  nbTotal: 10,
  nbAvailable: 5,
}

describe('ZTypology', () => {
  it('accepts a valid typology', () => {
    expect(ZTypology.safeParse(valid).success).toBe(true)
  })

  it('rejects priceMin greater than priceMax', () => {
    expect(ZTypology.safeParse({ ...valid, priceMin: 700, priceMax: 600 }).success).toBe(false)
  })

  it('rejects superficieMin greater than superficieMax', () => {
    expect(ZTypology.safeParse({ ...valid, superficieMin: 30, superficieMax: 20 }).success).toBe(false)
  })

  it('rejects nbAvailable greater than nbTotal', () => {
    expect(ZTypology.safeParse({ ...valid, nbTotal: 5, nbAvailable: 10 }).success).toBe(false)
  })

  it('accepte une superficie décimale et refuse une superficie hors colonne', () => {
    expect(ZTypology.safeParse({ ...valid, superficieMin: 29.7, superficieMax: 30.25 }).success).toBe(true)
    expect(ZTypology.safeParse({ ...valid, superficieMax: 10000 }).success).toBe(false)
  })

  it('enforces the minimum bounds (nbTotal >= 1, superficie >= 1)', () => {
    expect(ZTypology.safeParse({ ...valid, nbTotal: 0 }).success).toBe(false)
    expect(ZTypology.safeParse({ ...valid, superficieMin: 0 }).success).toBe(false)
  })

  it('allows a zero price and zero availability', () => {
    expect(ZTypology.safeParse({ ...valid, priceMin: 0, priceMax: 0, nbAvailable: 0 }).success).toBe(true)
  })

  it('accepts null or undefined numeric fields (colonnes nullables en base)', () => {
    expect(ZTypology.safeParse({ type: 't1', colocation: false }).success).toBe(true)
    expect(ZTypology.safeParse({ ...valid, superficieMin: null, superficieMax: null, nbTotal: null }).success).toBe(true)
    expect(ZTypology.safeParse({ ...valid, superficieMin: undefined, nbTotal: undefined }).success).toBe(true)
  })

  it('skips the cross-field comparisons when one side is missing', () => {
    expect(ZTypology.safeParse({ ...valid, priceMin: 700, priceMax: null }).success).toBe(true)
    expect(ZTypology.safeParse({ ...valid, superficieMin: 30, superficieMax: undefined }).success).toBe(true)
    expect(ZTypology.safeParse({ ...valid, nbTotal: null, nbAvailable: 10 }).success).toBe(true)
  })

  it('rejects an unknown typology type', () => {
    expect(ZTypology.safeParse({ ...valid, type: 't9' }).success).toBe(false)
  })
})

describe('ZTypologies', () => {
  it('requires at least one typology', () => {
    expect(ZTypologies.safeParse([]).success).toBe(false)
  })

  it('rejects duplicate types', () => {
    const result = ZTypologies.safeParse([valid, { ...valid }])
    expect(result.success).toBe(false)
  })

  it('accepts multiple distinct types', () => {
    expect(ZTypologies.safeParse([valid, { ...valid, type: 't2' }]).success).toBe(true)
  })
})
