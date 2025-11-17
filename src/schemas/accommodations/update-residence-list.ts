import { z } from 'zod'

export const ZUpdateResidenceList = z.object({
  nb_t1_available: z.number().min(0).nullable(),
  nb_t1_bis_available: z.number().min(0).nullable(),
  nb_t2_available: z.number().min(0).nullable(),
  nb_t3_available: z.number().min(0).nullable(),
  nb_t4_more_available: z.number().min(0).nullable(),
})

export type TUpdateResidenceList = z.infer<typeof ZUpdateResidenceList>
