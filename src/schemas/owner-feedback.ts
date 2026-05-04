import { z } from 'zod'

export const ZOwnerFeedbackSubmit = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

export type TOwnerFeedbackSubmit = z.infer<typeof ZOwnerFeedbackSubmit>
