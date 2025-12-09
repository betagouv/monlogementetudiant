import { z } from 'zod'

export const ZUpdateResidence = z.object({
  name: z.string().min(1, 'Le nom de la résidence est requis'),
  description: z.string().optional(),
  external_url: z.string().url('Veuillez saisir une URL valide').optional().or(z.literal('')),

  accept_waiting_list: z.boolean().optional(),

  nb_t1: z.number().min(0).nullish(),
  nb_t1_available: z.number().min(0).nullish(),
  price_min_t1: z.number().min(0).nullish(),
  price_max_t1: z.number().min(0).nullish(),

  nb_t1_bis: z.number().min(0).nullish(),
  nb_t1_bis_available: z.number().min(0).nullish(),
  price_min_t1_bis: z.number().min(0).nullish(),
  price_max_t1_bis: z.number().min(0).nullish(),

  nb_t2: z.number().min(0).nullish(),
  nb_t2_available: z.number().min(0).nullish(),
  price_min_t2: z.number().min(0).nullish(),
  price_max_t2: z.number().min(0).nullish(),

  nb_t3: z.number().min(0).nullish(),
  nb_t3_available: z.number().min(0).nullish(),
  price_min_t3: z.number().min(0).nullish(),
  price_max_t3: z.number().min(0).nullish(),

  nb_t4_more: z.number().min(0).nullish(),
  nb_t4_more_available: z.number().min(0).nullish(),
  price_min_t4_more: z.number().min(0).nullish(),
  price_max_t4_more: z.number().min(0).nullish(),

  nb_accessible_apartments: z.number().nullish(),

  refrigerator: z.boolean().optional(),
  laundry_room: z.boolean().optional(),
  bathroom: z.enum(['private', 'shared']).optional(),
  kitchen_type: z.enum(['private', 'shared']).optional(),
  microwave: z.boolean().optional(),
  secure_access: z.boolean().optional(),
  parking: z.boolean().optional(),
  common_areas: z.boolean().optional(),
  bike_storage: z.boolean().optional(),
  desk: z.boolean().optional(),
  residence_manager: z.boolean().optional(),
  cooking_plates: z.boolean().optional(),
  images_urls: z.array(z.string()).optional(),

  published: z.boolean().optional(),
  scholarship_holders_priority: z.boolean().optional(),
})

// For validation with existing accommodation data
export const createUpdateResidenceSchema = (existingData: {
  nb_t1?: number | null
  nb_t1_bis?: number | null
  nb_t2?: number | null
  nb_t3?: number | null
  nb_t4_more?: number | null
}) =>
  ZUpdateResidence.superRefine((data, ctx) => {
    const validations = [
      {
        total: data.nb_t1 ?? existingData.nb_t1,
        available: data.nb_t1_available,
        availablePath: 'nb_t1_available',
        type: 'T1',
      },
      {
        total: data.nb_t1_bis ?? existingData.nb_t1_bis,
        available: data.nb_t1_bis_available,
        availablePath: 'nb_t1_bis_available',
        type: 'T1 bis',
      },
      {
        total: data.nb_t2 ?? existingData.nb_t2,
        available: data.nb_t2_available,
        availablePath: 'nb_t2_available',
        type: 'T2',
      },
      {
        total: data.nb_t3 ?? existingData.nb_t3,
        available: data.nb_t3_available,
        availablePath: 'nb_t3_available',
        type: 'T3',
      },
      {
        total: data.nb_t4_more ?? existingData.nb_t4_more,
        available: data.nb_t4_more_available,
        availablePath: 'nb_t4_more_available',
        type: 'T4+',
      },
    ]

    for (const { total, available, availablePath, type } of validations) {
      if (total !== null && total !== undefined && available !== null && available !== undefined) {
        if (available > total) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Le nombre de logements ${type} disponibles ne peut pas être supérieur au nombre total (${total})`,
            path: [availablePath],
          })
        }
      }
    }
  })

export type TUpdateResidence = z.infer<typeof ZUpdateResidence>
