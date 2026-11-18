import { fromZonedTime } from 'date-fns-tz'
import { env } from '~/server/env'
import { DEFAULT_TIMEZONE } from '~/utils/formatDate'

export const SCHOLARSHIP_SURVEY_SCHOOL_YEAR = '2026-2027'

export const isSurveyActiveAt = (endDate: string | undefined, now: Date): boolean => {
  if (!endDate) return false
  return now <= fromZonedTime(`${endDate}T23:59:59.999`, DEFAULT_TIMEZONE)
}

export const isScholarshipSurveyActive = (now: Date = new Date()): boolean => isSurveyActiveAt(env.SCHOLARSHIP_SURVEY_END_DATE, now)
