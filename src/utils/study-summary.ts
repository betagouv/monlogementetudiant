import { type EStudyYear, STUDY_YEAR_SHORT_LABELS } from '~/enums/study-year'

type TStudySummaryTranslator = (key: 'workStudy' | 'studyYearAtStart', values?: { year: string }) => string

export const studySummaryParts = (
  input: { isWorkStudy: boolean | null; studyYear: EStudyYear | null },
  t: TStudySummaryTranslator,
): string[] => {
  const parts: string[] = []
  if (input.isWorkStudy) parts.push(t('workStudy'))
  if (input.studyYear) parts.push(t('studyYearAtStart', { year: STUDY_YEAR_SHORT_LABELS[input.studyYear] }))
  return parts
}
