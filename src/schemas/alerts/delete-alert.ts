import { z } from 'zod'

export const ZDeleteAlert = z.object({
  id: z.number(),
})

export type TDeleteAlert = z.infer<typeof ZDeleteAlert>
