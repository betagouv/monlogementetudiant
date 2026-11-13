import { describe, expect, it } from 'vitest'
import { EStudyYear } from '~/enums/study-year'
import { studySummaryParts } from '~/utils/study-summary'

const t = (key: 'workStudy' | 'studyYearAtStart', values?: { year: string }) =>
  key === 'workStudy' ? 'Alternant' : `${values?.year} à la rentrée`

describe('studySummaryParts', () => {
  it('lists work-study and study year', () => {
    expect(studySummaryParts({ isWorkStudy: true, studyYear: EStudyYear.BAC_3 }, t)).toEqual(['Alternant', 'Bac+3 à la rentrée'])
  })

  it('omits work-study when false or unknown', () => {
    expect(studySummaryParts({ isWorkStudy: false, studyYear: null }, t)).toEqual([])
    expect(studySummaryParts({ isWorkStudy: null, studyYear: EStudyYear.BAC_1 }, t)).toEqual(['Bac+1 à la rentrée'])
  })

  it('uses the short label of the last year bucket', () => {
    expect(studySummaryParts({ isWorkStudy: null, studyYear: EStudyYear.BAC_5_PLUS }, t)).toEqual(['Bac+5 et + à la rentrée'])
  })
})
