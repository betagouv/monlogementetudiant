import { describe, expect, it } from 'vitest'
import { availabilityRecentSince, formatRecentSince } from './availability-freshness'

describe('availabilityRecentSince', () => {
  it('remonte de 31 jours', () => {
    expect(availabilityRecentSince(new Date('2026-11-18T10:00:00Z'))).toBe('2026-10-18')
  })

  it('le relevé du 1er avril couvre encore une mise à jour du 1er mars', () => {
    expect(availabilityRecentSince(new Date('2027-04-01T01:30:00Z'))).toBe('2027-03-01')
  })

  it('raisonne en heure de Paris (le 31 à 23h30 UTC est déjà le 1er à Paris)', () => {
    expect(availabilityRecentSince(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-01')
  })

  it('passe l’année', () => {
    expect(availabilityRecentSince(new Date('2027-01-15T12:00:00Z'))).toBe('2026-12-15')
  })
})

describe('formatRecentSince', () => {
  it('formate en toutes lettres', () => {
    expect(formatRecentSince('2026-10-01')).toBe('1er octobre 2026')
    expect(formatRecentSince('2026-10-18')).toBe('18 octobre 2026')
  })
})
