import { describe, expect, it } from 'vitest'
import { formatDelay } from './format-admin'

describe('formatDelay', () => {
  it.each([
    [null, '—'],
    [59, '59 s'],
    [60, '1 min'],
    [3600, '1 h'],
    [86400, '1 j'],
  ])('formats %s as %s', (seconds, expected) => {
    expect(formatDelay(seconds)).toBe(expected)
  })
})
