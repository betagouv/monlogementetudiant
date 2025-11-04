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

  nb_total_apartments: z.number().min(0).nullish(),
  nb_accessible_apartments: z.number().min(0).nullish(),
  nb_coliving_apartments: z.number().min(0).nullish(),

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
})

export type TUpdateResidence = z.infer<typeof ZUpdateResidence>
