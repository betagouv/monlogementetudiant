import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOverMaxApplicantAge } from './applicant-age'

describe('isOverMaxApplicantAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('accepte jusqu’à 30 ans révolus', () => {
    expect(isOverMaxApplicantAge('1996-03-14')).toBe(false)
    expect(isOverMaxApplicantAge('1995-11-19')).toBe(false)
  })

  it('refuse à partir de 31 ans', () => {
    expect(isOverMaxApplicantAge('1995-11-18')).toBe(true)
    expect(isOverMaxApplicantAge('1994-03-14')).toBe(true)
  })

  it('ne refuse pas une date absente ou invalide', () => {
    expect(isOverMaxApplicantAge(null)).toBe(false)
    expect(isOverMaxApplicantAge('pas une date')).toBe(false)
  })
})
