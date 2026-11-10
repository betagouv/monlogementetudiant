import { describe, expect, it } from 'vitest'
import { isAnswerFilled, ZScholarshipSurveyAnswer } from '.'

const base = { accommodationId: 1, scholarshipCount: null, scholarshipRate: null, notMeasured: false }

describe('ZScholarshipSurveyAnswer', () => {
  it('refuse une valeur avec « non mesuré »', () => {
    expect(ZScholarshipSurveyAnswer.safeParse({ ...base, notMeasured: true, scholarshipCount: 3 }).success).toBe(false)
  })

  it('refuse un pourcentage hors bornes', () => {
    expect(ZScholarshipSurveyAnswer.safeParse({ ...base, scholarshipRate: 101 }).success).toBe(false)
    expect(ZScholarshipSurveyAnswer.safeParse({ ...base, scholarshipRate: -1 }).success).toBe(false)
  })

  it('refuse un nombre négatif', () => {
    expect(ZScholarshipSurveyAnswer.safeParse({ ...base, scholarshipCount: -1 }).success).toBe(false)
  })

  it('accepte nombre et pourcentage ensemble', () => {
    expect(ZScholarshipSurveyAnswer.safeParse({ ...base, scholarshipCount: 18, scholarshipRate: 12 }).success).toBe(true)
  })
})

describe('isAnswerFilled', () => {
  it('est vrai avec un nombre, un pourcentage ou « non mesuré »', () => {
    expect(isAnswerFilled({ ...base, scholarshipCount: 0 })).toBe(true)
    expect(isAnswerFilled({ ...base, scholarshipRate: 35 })).toBe(true)
    expect(isAnswerFilled({ ...base, notMeasured: true })).toBe(true)
  })

  it('est faux sans aucune valeur', () => {
    expect(isAnswerFilled(base)).toBe(false)
  })
})
