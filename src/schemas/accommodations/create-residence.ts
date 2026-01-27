import { z } from 'zod'
import { ZUpdateResidence } from './update-residence'

export const ZCreateResidence = ZUpdateResidence.extend({
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postal_code: z.string().min(1, 'Le code postal est requis'),
  longitude: z.number({ required_error: 'La longitude est requise' }),
  latitude: z.number({ required_error: 'La latitude est requise' }),
})

export type TCreateResidence = z.infer<typeof ZCreateResidence>
