import { describe, expect, it } from 'vitest'
import { buildHref } from './preserve-query-params'

describe('buildHref', () => {
  describe('without searchParams', () => {
    it('returns pathname unchanged when source is null', () => {
      expect(buildHref('/bailleur/residences', null)).toBe('/bailleur/residences')
    })

    it('returns pathname unchanged when source is undefined', () => {
      expect(buildHref('/bailleur/residences', undefined)).toBe('/bailleur/residences')
    })

    it('returns pathname unchanged when source is an empty object', () => {
      expect(buildHref('/bailleur/residences', {})).toBe('/bailleur/residences')
    })

    it('returns pathname unchanged when source is an empty URLSearchParams', () => {
      expect(buildHref('/bailleur/residences', new URLSearchParams())).toBe('/bailleur/residences')
    })
  })

  describe('with URLSearchParams', () => {
    it('preserves ownerId from URLSearchParams', () => {
      const params = new URLSearchParams('ownerId=42')
      expect(buildHref('/bailleur/residences', params)).toBe('/bailleur/residences?ownerId=42')
    })

    it('ignores non-persisted params from URLSearchParams', () => {
      const params = new URLSearchParams('ownerId=42&page=3&recherche=foo')
      expect(buildHref('/bailleur/residences', params)).toBe('/bailleur/residences?ownerId=42')
    })

    it('returns pathname unchanged when URLSearchParams has only non-persisted params', () => {
      const params = new URLSearchParams('page=3&recherche=foo')
      expect(buildHref('/bailleur/residences', params)).toBe('/bailleur/residences')
    })

    it('supports duck-typed sources with a get method (e.g. ReadonlyURLSearchParams)', () => {
      const readonlyLike = { get: (key: string) => (key === 'ownerId' ? '7' : null) }
      expect(buildHref('/bailleur/residences', readonlyLike)).toBe('/bailleur/residences?ownerId=7')
    })
  })

  describe('with plain object', () => {
    it('preserves ownerId from a plain object', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' })).toBe('/bailleur/residences?ownerId=42')
    })

    it('ignores non-persisted params from a plain object', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42', page: '3', recherche: 'foo' })).toBe('/bailleur/residences?ownerId=42')
    })

    it('takes the first value when param is an array', () => {
      expect(buildHref('/bailleur/residences', { ownerId: ['1', '2'] })).toBe('/bailleur/residences?ownerId=1')
    })

    it('ignores undefined param values', () => {
      expect(buildHref('/bailleur/residences', { ownerId: undefined })).toBe('/bailleur/residences')
    })

    it('ignores empty string param values', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '' })).toBe('/bailleur/residences')
    })
  })

  describe('with overrides', () => {
    it('adds an override that is not in PERSISTED_QUERY_PARAMS', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' }, { page: 5 })).toBe('/bailleur/residences?ownerId=42&page=5')
    })

    it('overrides a persisted param value', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' }, { ownerId: 99 })).toBe('/bailleur/residences?ownerId=99')
    })

    it('removes a persisted param when override value is undefined', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' }, { ownerId: undefined })).toBe('/bailleur/residences')
    })

    it('removes a persisted param when override value is null', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' }, { ownerId: null })).toBe('/bailleur/residences')
    })

    it('removes a persisted param when override value is empty string', () => {
      expect(buildHref('/bailleur/residences', { ownerId: '42' }, { ownerId: '' })).toBe('/bailleur/residences')
    })

    it('coerces number overrides to strings', () => {
      expect(buildHref('/bailleur/residences', null, { ownerId: 7 })).toBe('/bailleur/residences?ownerId=7')
    })

    it('works with only overrides and no source', () => {
      expect(buildHref('/bailleur/residences', null, { ownerId: 7, page: 2 })).toBe('/bailleur/residences?ownerId=7&page=2')
    })
  })
})
