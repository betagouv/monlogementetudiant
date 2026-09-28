import { describe, expect, it } from 'vitest'
import { formatFrenchPhoneNumber, normalizeFrenchPhoneNumber, toTelHref } from './phone-number'

describe('normalizeFrenchPhoneNumber', () => {
  it.each([
    ['01 45 67 89 10', '0145678910'],
    ['01.45.67.89.10', '0145678910'],
    ['01-45-67-89-10', '0145678910'],
    ['+33 1 45 67 89 10', '0145678910'],
    ['+33 (0)1 45 67 89 10', '0145678910'],
    ['0033145678910', '0145678910'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeFrenchPhoneNumber(input)).toBe(expected)
  })
})

describe('formatFrenchPhoneNumber', () => {
  it('groups digits by pairs', () => {
    expect(formatFrenchPhoneNumber('0145678910')).toBe('01 45 67 89 10')
    expect(formatFrenchPhoneNumber('+33145678910')).toBe('01 45 67 89 10')
  })

  it('returns invalid input untouched', () => {
    expect(formatFrenchPhoneNumber('12345')).toBe('12345')
  })
})

describe('toTelHref', () => {
  it('builds an international tel link', () => {
    expect(toTelHref('01 45 67 89 10')).toBe('tel:+33145678910')
  })
})
