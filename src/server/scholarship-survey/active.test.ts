import { describe, expect, it } from 'vitest'
import { isSurveyActiveAt } from './active'

describe('isSurveyActiveAt', () => {
  it('est inactive sans date de fin', () => {
    expect(isSurveyActiveAt(undefined, new Date())).toBe(false)
  })

  it('reste active jusqu’à 23:59:59 heure de Paris le jour de fin', () => {
    expect(isSurveyActiveAt('2026-11-30', new Date('2026-11-30T22:59:59Z'))).toBe(true)
  })

  it('se ferme à minuit heure de Paris', () => {
    expect(isSurveyActiveAt('2026-11-30', new Date('2026-11-30T23:00:00Z'))).toBe(false)
  })

  it('est active avant la date de fin', () => {
    expect(isSurveyActiveAt('2026-11-30', new Date('2026-10-01T00:00:00Z'))).toBe(true)
  })
})
