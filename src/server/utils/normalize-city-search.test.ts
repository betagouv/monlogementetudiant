import { describe, expect, it } from 'vitest'
import { normalizeCitySearch, tokenizeQuery } from './normalize-city-search'

describe('normalizeCitySearch', () => {
  it.each([
    ['Saint-Étienne', 'saint etienne'],
    ['St Etienne', 'saint etienne'],
    ['STE-ETIENNE', 'saint etienne'],
    ['  St   Étienne  ', 'saint etienne'],
    ['Évry-Courcouronnes', 'evry courcouronnes'],
    ['Œuilly', 'oeuilly'],
    ['Ælfred', 'aelfred'],
    ['SAINT-MALO', 'saint malo'],
    ['st-malo', 'saint malo'],
    ['ste foy', 'saint foy'],
    ['Luçon', 'lucon'],
    ['', ''],
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeCitySearch(input)).toBe(expected)
  })
})

describe('tokenizeQuery', () => {
  it('splits on spaces and filters short tokens', () => {
    expect(tokenizeQuery('saint etienne')).toEqual(['saint', 'etienne'])
  })

  it('filters out tokens shorter than 2 chars', () => {
    expect(tokenizeQuery('a saint b etienne')).toEqual(['saint', 'etienne'])
  })

  it('returns empty array for empty string', () => {
    expect(tokenizeQuery('')).toEqual([])
  })

  it('returns empty array when all tokens are too short', () => {
    expect(tokenizeQuery('a b c')).toEqual([])
  })
})
