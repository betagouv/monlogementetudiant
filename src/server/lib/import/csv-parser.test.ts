import { describe, expect, it } from 'vitest'
import { toDecimal } from './csv-parser'

describe('toDecimal', () => {
  it.each([
    ['29,7', 29.7],
    ['29.7', 29.7],
    ['18 m²', 18],
    ['18,5m2', 18.5],
  ])('lit la superficie %j comme %d', (input, expected) => {
    expect(toDecimal(input)).toBe(expected)
  })

  it.each([[undefined], [''], ['0'], ['abc']])('ignore %j', (input) => {
    expect(toDecimal(input)).toBeNull()
  })
})
