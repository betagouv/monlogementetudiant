import { z } from 'zod'

export const ZAccommodationSelection = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }),
  z.object({ mode: z.literal('restricted'), accommodationIds: z.array(z.number().int().positive()).max(2000) }),
])

export type TAccommodationSelection = z.infer<typeof ZAccommodationSelection>
