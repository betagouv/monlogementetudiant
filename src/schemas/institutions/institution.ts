import { z } from 'zod'

export const ZInstitution = z.object({
  id: z.number(),
  geometry: z.object({
    type: z.string(),
    coordinates: z.array(z.number()),
  }),
  properties: z.object({
    name: z.string(),
    city: z.string(),
    address: z.string(),
    postal_code: z.string(),
    website: z.string(),
  }),
})

export type TInstitution = z.infer<typeof ZInstitution>

export const ZGetInstitutionsResponse = z.object({
  features: z.array(ZInstitution),
})

export type TGetInstitutionsResponse = z.infer<typeof ZGetInstitutionsResponse>
