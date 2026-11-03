import { describe, expect, it } from 'vitest'
import { formatSurface, parseDecimal } from './parse-decimal'

describe('parseDecimal', () => {
  it.each([
    ['29', 29],
    [29, 29],
    ['29,7', 29.7],
    ['29.7', 29.7],
    [' 29 ', 29],
    ['1 029,5', 1029.5],
    ['18,456', 18.46],
    [29.7, 29.7],
    [18.456, 18.46],
  ])('lit %j comme %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each([
    [''],
    ['abc'],
    ['29,7,1'],
    ['29.7m'],
    ['1e3'],
    ['0x1A'],
    ['Infinity'],
    [null],
    [undefined],
    [Number.NaN],
  ])('rejette %j', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe('formatSurface', () => {
  it('affiche la décimale avec une virgule, et rien pour un entier', () => {
    expect(formatSurface(29.7)).toBe('29,7')
    expect(formatSurface(18)).toBe('18')
  })
})
