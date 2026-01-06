import { z } from 'zod'

export const ZCreateAlertRequest = z.object({
  name: z.string().min(1, "Le nom de l'alerte est requis"),
  city_id: z.number().optional(),
  department_id: z.number().optional(),
  academy_id: z.number().optional(),
  has_coliving: z.boolean(),
  is_accessible: z.boolean(),
  max_price: z.number().min(1, 'Le prix maximum doit être supérieur à 0'),
})

export type TCreateAlertRequest = z.infer<typeof ZCreateAlertRequest>
