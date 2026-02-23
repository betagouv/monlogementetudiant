import { z } from 'zod'
import { ZAccomodation } from '~/schemas/accommodations/accommodations'

export const ZGetAccomodationsResponse = z.object({
  count: z.number(),
  next: z.string().nullable(),
  min_price: z.number().nullable(),
  max_price: z.number().nullable(),
  page_size: z.number(),
  previous: z.string().nullable(),
  results: z.object({
    features: z.array(ZAccomodation),
  }),
})

export type TGetAccomodationsResponse = z.infer<typeof ZGetAccomodationsResponse>
