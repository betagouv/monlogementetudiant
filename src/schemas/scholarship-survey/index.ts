import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZScholarshipSurveyAnswer = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .object({
      accommodationId: z.number().int().positive(),
      scholarshipCount: z.number().int(t('errors.scholarshipCountInvalid')).min(0, t('errors.scholarshipCountInvalid')).nullable(),
      scholarshipRate: z
        .number()
        .int(t('errors.scholarshipRateInvalid'))
        .min(0, t('errors.scholarshipRateInvalid'))
        .max(100, t('errors.scholarshipRateInvalid'))
        .nullable(),
      notMeasured: z.boolean(),
    })
    .refine((a) => !a.notMeasured || (a.scholarshipCount === null && a.scholarshipRate === null), {
      message: t('errors.scholarshipNotMeasuredConflict'),
      path: ['notMeasured'],
    })

export const ZScholarshipSurveyAnswer = createZScholarshipSurveyAnswer()
export type TScholarshipSurveyAnswer = z.infer<typeof ZScholarshipSurveyAnswer>

export const ZScholarshipSurveySaveInput = z.object({
  ownerId: z.number().int().positive().optional(),
  answers: z.array(ZScholarshipSurveyAnswer).max(2000),
})
export type TScholarshipSurveySaveInput = z.infer<typeof ZScholarshipSurveySaveInput>

export const isAnswerFilled = (a: Pick<TScholarshipSurveyAnswer, 'scholarshipCount' | 'scholarshipRate' | 'notMeasured'>): boolean =>
  a.notMeasured || a.scholarshipCount !== null || a.scholarshipRate !== null

const answerKey = (a: TScholarshipSurveyAnswer | null): string =>
  a && isAnswerFilled(a) ? `${a.scholarshipCount ?? ''}|${a.scholarshipRate ?? ''}|${a.notMeasured}` : ''

export const getChangedAnswers = (
  current: TScholarshipSurveyAnswer[],
  saved: ReadonlyMap<number, TScholarshipSurveyAnswer | null>,
): TScholarshipSurveyAnswer[] => current.filter((a) => answerKey(a) !== answerKey(saved.get(a.accommodationId) ?? null))
