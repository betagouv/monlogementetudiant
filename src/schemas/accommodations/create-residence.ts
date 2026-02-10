import { z } from 'zod'
import { ZUpdateResidence } from './update-residence'

export const TYPOLOGY_TYPES = ['T1', 'T1 bis', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7+'] as const

export const TYPOLOGY_LABELS: Record<string, string> = {
  T1: 'Studio T1',
  'T1 bis': 'Studio T1 bis',
  T2: 'Logement T2',
  T3: 'Logement T3',
  T4: 'Logement T4',
  T5: 'Logement T5',
  T6: 'Logement T6',
  'T7+': 'Logement T7+',
}

export const TYPE_TO_KEY: Record<string, string> = {
  T1: 't1',
  'T1 bis': 't1_bis',
  T2: 't2',
  T3: 't3',
  T4: 't4',
  T5: 't5',
  T6: 't6',
  'T7+': 't7_more',
}

export const ZTypology = z
  .object({
    type: z.enum(TYPOLOGY_TYPES, { error: 'Veuillez sélectionner un type de logement' }),
    price_min: z.number({ error: 'Le loyer minimum est requis' }).min(0, 'Le loyer minimum doit être positif'),
    price_max: z.number({ error: 'Le loyer maximum est requis' }).min(0, 'Le loyer maximum doit être positif'),
    colocation: z.boolean(),
    nb_total: z.number({ error: 'Le nombre total est requis' }).min(1, 'Le nombre total doit être au moins 1'),
    nb_available: z.number({ error: 'Le nombre disponible est requis' }).min(0, 'Le nombre disponible doit être positif'),
  })
  .superRefine((data, ctx) => {
    if (data.price_min > data.price_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le loyer minimum ne peut pas être supérieur au loyer maximum',
        path: ['price_min'],
      })
    }
    if (data.nb_available > data.nb_total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le nombre de logements disponibles ne peut pas être supérieur au nombre total (${data.nb_total})`,
        path: ['nb_available'],
      })
    }
  })

export type TTypology = z.infer<typeof ZTypology>

export const ZCreateResidence = ZUpdateResidence.omit({
  nb_t1: true,
  nb_t1_available: true,
  price_min_t1: true,
  price_max_t1: true,
  nb_t1_bis: true,
  nb_t1_bis_available: true,
  price_min_t1_bis: true,
  price_max_t1_bis: true,
  nb_t2: true,
  nb_t2_available: true,
  price_min_t2: true,
  price_max_t2: true,
  nb_t3: true,
  nb_t3_available: true,
  price_min_t3: true,
  price_max_t3: true,
  nb_t4: true,
  nb_t4_available: true,
  price_min_t4: true,
  price_max_t4: true,
  nb_t5: true,
  nb_t5_available: true,
  price_min_t5: true,
  price_max_t5: true,
  nb_t6: true,
  nb_t6_available: true,
  price_min_t6: true,
  price_max_t6: true,
  nb_t7_more: true,
  nb_t7_more_available: true,
  price_min_t7_more: true,
  price_max_t7_more: true,
}).extend({
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postal_code: z.string().min(1, 'Le code postal est requis'),
  external_url: z.string().url('Veuillez saisir une URL valide').min(1, "L'URL de redirection est requise"),
  images_files: z.array(z.instanceof(File)).optional(),
  typologies: z
    .array(ZTypology)
    .min(1, 'Au moins un type de logement est requis')
    .superRefine((typologies, ctx) => {
      const types = typologies.map((t) => t.type)
      const seen = new Set<string>()
      for (let i = 0; i < types.length; i++) {
        if (seen.has(types[i])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Le type "${types[i]}" est déjà utilisé`,
            path: [i, 'type'],
          })
        }
        seen.add(types[i])
      }
    }),
})

export type TCreateResidence = z.infer<typeof ZCreateResidence>

export function transformTypologiesToFlat(typologies: TTypology[]) {
  const flat: Record<string, number | null> = {}

  for (const key of Object.values(TYPE_TO_KEY)) {
    flat[`nb_${key}`] = null
    flat[`nb_${key}_available`] = null
    flat[`price_min_${key}`] = null
    flat[`price_max_${key}`] = null
  }

  for (const t of typologies) {
    const key = TYPE_TO_KEY[t.type]
    if (!key) continue
    flat[`nb_${key}`] = t.nb_total
    flat[`nb_${key}_available`] = t.nb_available
    flat[`price_min_${key}`] = t.price_min
    flat[`price_max_${key}`] = t.price_max
  }

  return flat
}
