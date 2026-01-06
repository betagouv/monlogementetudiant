import { z } from 'zod'

export const ZUpdateAlertRequest = z.object({
  name: z.string().min(1, "Le nom de l'alerte est requis").optional(),
  city_id: z.number().optional(),
  department_id: z.number().optional(),
  academy_id: z.number().optional(),
  has_coliving: z.boolean().optional(),
  is_accessible: z.boolean().optional(),
  max_price: z.number().min(1, 'Le prix maximum doit être supérieur à 0').optional(),
  id: z.number(),
  receive_notifications: z.boolean().optional(),
})

export type TUpdateAlertRequest = z.infer<typeof ZUpdateAlertRequest>
