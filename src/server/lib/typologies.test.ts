import { describe, expect, it } from 'vitest'
import { groupTypologiesByAccommodation, type TTypologyView, typologiesByType, typologyAggregates, typologyDraft } from './typologies'

describe('typologyDraft', () => {
  it('defaults every missing numeric field to null', () => {
    expect(typologyDraft('t1')).toEqual({
      type: 't1',
      priceMin: null,
      priceMax: null,
      superficieMin: null,
      superficieMax: null,
      nbTotal: null,
      nbAvailable: null,
      colocation: false,
    })
  })

  it('defaults colocation from isPerPersonTypology (t3 and above are per-person)', () => {
    expect(typologyDraft('t1').colocation).toBe(false)
    expect(typologyDraft('t1_bis').colocation).toBe(false)
    expect(typologyDraft('t2').colocation).toBe(false)
    expect(typologyDraft('t3').colocation).toBe(true)
    expect(typologyDraft('t5').colocation).toBe(true)
    expect(typologyDraft('t7_more').colocation).toBe(true)
  })

  it('respects an explicit colocation override', () => {
    expect(typologyDraft('t3', { colocation: false }).colocation).toBe(false)
    expect(typologyDraft('t1', { colocation: true }).colocation).toBe(true)
  })

  it('keeps the provided numeric fields and nulls the rest', () => {
    expect(typologyDraft('t2', { nbTotal: 10, priceMin: 400, superficieMax: 30 })).toMatchObject({
      type: 't2',
      nbTotal: 10,
      priceMin: 400,
      superficieMax: 30,
      priceMax: null,
      superficieMin: null,
      nbAvailable: null,
    })
  })
})

describe('typologyAggregates', () => {
  it('sums nbTotal, ignoring nulls', () => {
    expect(typologyAggregates([{ nbTotal: 10 }, { nbTotal: 5 }, { nbTotal: null }]).nbTotalApartments).toBe(15)
  })

  it('returns null nbTotalApartments when every count is null', () => {
    expect(typologyAggregates([{ nbTotal: null }, {}]).nbTotalApartments).toBeNull()
  })

  it('takes min/max of strictly positive prices only (0 and null ignored)', () => {
    const agg = typologyAggregates([
      { priceMin: 0, priceMax: 0 },
      { priceMin: 400, priceMax: 600 },
      { priceMin: null, priceMax: null },
      { priceMin: 350, priceMax: 900 },
    ])
    expect(agg.priceMin).toBe(350)
    expect(agg.priceMax).toBe(900)
  })

  it('returns null prices when no positive price exists', () => {
    const agg = typologyAggregates([{ priceMin: 0, priceMax: 0 }, { priceMin: null }])
    expect(agg.priceMin).toBeNull()
    expect(agg.priceMax).toBeNull()
  })

  it('keeps nbAvailableApartments null when all availabilities are null, but 0 when any is 0', () => {
    // "unknown availability" (all null) stays distinct from "0 available".
    expect(typologyAggregates([{ nbAvailable: null }, {}]).nbAvailableApartments).toBeNull()
    expect(typologyAggregates([{ nbAvailable: 0 }, { nbAvailable: null }]).nbAvailableApartments).toBe(0)
    expect(typologyAggregates([{ nbAvailable: 3 }, { nbAvailable: 2 }]).nbAvailableApartments).toBe(5)
  })
})

describe('typologiesByType', () => {
  const row = (type: string, over: Partial<TTypologyView> = {}) => ({
    id: 1,
    accommodationId: 1,
    type,
    priceMin: 400,
    priceMax: 600,
    superficieMin: 15,
    superficieMax: 25,
    nbTotal: 10,
    nbAvailable: 5,
    colocation: false,
    ...over,
  })

  it('indexes child rows by their type using the view shape', () => {
    const out = typologiesByType([row('t1'), row('t3', { colocation: true, priceMin: 800 })] as never)
    expect(out.t1).toEqual({
      priceMin: 400,
      priceMax: 600,
      superficieMin: 15,
      superficieMax: 25,
      nbTotal: 10,
      nbAvailable: 5,
      colocation: false,
      availabilityUpdatedAt: null,
    })
    expect(out.t3?.colocation).toBe(true)
    expect(out.t3?.priceMin).toBe(800)
    expect(out.t2).toBeUndefined()
  })

  it('exposes the availability update date as an ISO string', () => {
    const out = typologiesByType([{ ...row('t1'), availabilityUpdatedAt: new Date('2026-08-07T10:00:00Z') }] as never)
    expect(out.t1?.availabilityUpdatedAt).toBe('2026-08-07T10:00:00.000Z')
  })

  it('returns an empty object for no rows', () => {
    expect(typologiesByType([])).toEqual({})
  })
})

describe('groupTypologiesByAccommodation', () => {
  it('groups rows by accommodationId, preserving order', () => {
    const rows = [
      { accommodationId: 1, type: 't1' },
      { accommodationId: 2, type: 't1' },
      { accommodationId: 1, type: 't2' },
    ]
    const out = groupTypologiesByAccommodation(rows)
    expect(out.get(1)).toEqual([
      { accommodationId: 1, type: 't1' },
      { accommodationId: 1, type: 't2' },
    ])
    expect(out.get(2)).toEqual([{ accommodationId: 2, type: 't1' }])
    expect(out.get(3)).toBeUndefined()
  })

  it('returns an empty map for no rows', () => {
    expect(groupTypologiesByAccommodation([]).size).toBe(0)
  })
})
