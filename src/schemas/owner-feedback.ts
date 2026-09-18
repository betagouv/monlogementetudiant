import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const OWNER_FEEDBACK_COMMENT_MAX_LENGTH = 2000

export const createZOwnerFeedbackSubmit = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    rating: z.number().int().min(1).max(5),
    comment: z
      .string()
      .max(OWNER_FEEDBACK_COMMENT_MAX_LENGTH, t('errors.feedbackCommentMaxLength', { max: OWNER_FEEDBACK_COMMENT_MAX_LENGTH }))
      .optional(),
  })

export const ZOwnerFeedbackSubmit = createZOwnerFeedbackSubmit()

export type TOwnerFeedbackSubmit = z.infer<typeof ZOwnerFeedbackSubmit>
