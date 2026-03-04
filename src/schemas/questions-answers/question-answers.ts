import { z } from 'zod'

export const ZQuestionAnswers = z.object({
  content_fr: z.string(),
  id: z.number(),
  title_fr: z.string(),
})

export const ZGlobalQuestionsAnswers = z.array(ZQuestionAnswers)
export type TGlobalQuestionsAnswers = z.infer<typeof ZGlobalQuestionsAnswers>
