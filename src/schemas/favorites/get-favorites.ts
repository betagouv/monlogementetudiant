import { z } from 'zod'
import { ZAccomodation } from '~/schemas/accommodations/accommodations'

export const ZGetFavoritesResponse = z.object({
  count: z.number(),
  next: z.string().nullable(),
  page_size: z.number(),
  previous: z.string().nullable(),
  results: z.array(ZAccomodation),
})

export type TGetFavoritesResponse = z.infer<typeof ZGetFavoritesResponse>
