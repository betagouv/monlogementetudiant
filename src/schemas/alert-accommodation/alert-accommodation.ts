import { z } from 'zod'

export const ZAlertAccommodationFormSchema = z.object({
  email: z.string().email().min(1, { message: 'Votre email est requis.' }),
  territory_name: z.string().min(1, { message: 'Une ville est requise.' }),
  territory_type: z.string(),
  kind: z.enum(['accommodation', 'newsletter']),
})

export type TAlertAccommodationForm = z.infer<typeof ZAlertAccommodationFormSchema>
