import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeAge, daysLeftFrom, formatIsoDate, formatLocalizedDate } from './date-helpers'

describe('date-helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22, 15, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatLocalizedDate', () => {
    it('formate selon la locale, en français par défaut', () => {
      expect(formatLocalizedDate(new Date(2026, 9, 2), 'dd MMMM yyyy', 'fr')).toBe('02 octobre 2026')
      expect(formatLocalizedDate(new Date(2026, 9, 2), 'dd MMMM yyyy', 'en-GB')).toBe('02 October 2026')
      expect(formatLocalizedDate('2026-10-02', 'dd MMMM yyyy', null)).toBe('02 octobre 2026')
    })
  })

  describe('formatIsoDate', () => {
    it('lit une date ISO sans heure comme une date locale', () => {
      expect(formatIsoDate('2026-10-02')).toBe('2026-10-02')
      expect(formatIsoDate(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02')
    })
  })

  describe('computeAge', () => {
    it('compte les années révolues, anniversaire inclus', () => {
      expect(computeAge('2000-10-22')).toBe(26)
      expect(computeAge('2000-10-23')).toBe(25)
    })

    it('retourne null si la date est absente, invalide ou future', () => {
      expect(computeAge(null)).toBeNull()
      expect(computeAge('')).toBeNull()
      expect(computeAge('2026-13-45')).toBeNull()
      expect(computeAge('2030-01-01')).toBeNull()
    })
  })

  describe('daysLeftFrom', () => {
    it("compte les jours calendaires jusqu'à l'échéance, sans descendre sous 0", () => {
      expect(daysLeftFrom(new Date(2026, 9, 2, 0, 30), 30)).toBe(10)
      expect(daysLeftFrom(new Date(2026, 9, 22, 23, 59), 0)).toBe(0)
      expect(daysLeftFrom(new Date(2026, 8, 1), 30)).toBe(0)
    })

    it('retourne null si la date de départ est absente ou invalide', () => {
      expect(daysLeftFrom(undefined, 30)).toBeNull()
      expect(daysLeftFrom('nope', 30)).toBeNull()
    })
  })
})
