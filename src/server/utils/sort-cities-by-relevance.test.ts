import { describe, expect, it } from 'vitest'
import { sortCitiesByRelevance } from '~/server/utils/sort-cities-by-relevance'

function makeCities(names: string[]) {
  return names.map((city) => ({ city, rentPerM2: 10, rentFor20M2: 200 }))
}

describe('sortCitiesByRelevance', () => {
  it('puts exact match first', () => {
    const cities = makeCities(['Paris 1er', 'Lyon', 'Paris'])
    const result = sortCitiesByRelevance(cities, 'paris')
    expect(result[0].city).toBe('Paris')
  })

  it('sorts arrondissements numerically', () => {
    const cities = makeCities(['Paris 10e', 'Paris 2e', 'Paris 1er', 'Paris'])
    const result = sortCitiesByRelevance(cities, 'paris')
    expect(result[0].city).toBe('Paris')
    expect(result[1].city).toBe('Paris 1er')
    expect(result[2].city).toBe('Paris 2e')
    expect(result[3].city).toBe('Paris 10e')
  })

  it('prioritizes prefix matches over contains', () => {
    const cities = makeCities(['Villeparis', 'Paris 5e', 'Parisis'])
    const result = sortCitiesByRelevance(cities, 'paris')
    expect(result[0].city).toBe('Paris 5e')
    expect(result[1].city).toBe('Parisis')
    expect(result[2].city).toBe('Villeparis')
  })

  it('falls back to localeCompare for non-matching entries', () => {
    const cities = makeCities(['Bordeaux', 'Amiens'])
    const result = sortCitiesByRelevance(cities, 'other')
    expect(result[0].city).toBe('Amiens')
    expect(result[1].city).toBe('Bordeaux')
  })

  it('returns empty array for empty input', () => {
    const result = sortCitiesByRelevance([], 'paris')
    expect(result).toEqual([])
  })
})
