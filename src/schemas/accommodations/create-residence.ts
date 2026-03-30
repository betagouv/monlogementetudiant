import { z } from 'zod'
import { ZUpdateResidence } from './update-residence'

// Constante centralisée pour toutes les typologies
export const TYPOLOGIES = [
  { type: 'T1', fieldSuffix: 't1', label: 'Studio T1' },
  { type: 'T1 bis', fieldSuffix: 't1_bis', label: 'Studio T1 bis' },
  { type: 'T2', fieldSuffix: 't2', label: 'Logement T2' },
  { type: 'T3', fieldSuffix: 't3', label: 'Logement T3' },
  { type: 'T4', fieldSuffix: 't4', label: 'Logement T4' },
  { type: 'T5', fieldSuffix: 't5', label: 'Logement T5' },
  { type: 'T6', fieldSuffix: 't6', label: 'Logement T6' },
  { type: 'T7+', fieldSuffix: 't7_more', label: 'Logement T7+' },
] as const

export type TypologyType = (typeof TYPOLOGIES)[number]['type']
export type TypologyFieldSuffix = (typeof TYPOLOGIES)[number]['fieldSuffix']

// Helper pour obtenir le label complet depuis un type
export const getTypologyLabel = (type: string): string => TYPOLOGIES.find((t) => t.type === type)?.label ?? type

// Dérivés pour compatibilité
export const TYPOLOGY_TYPES = TYPOLOGIES.map((t) => t.type) as unknown as readonly TypologyType[]

export const TYPE_TO_KEY: Record<string, string> = Object.fromEntries(TYPOLOGIES.map((t) => [t.type, t.fieldSuffix]))

export const ZTypology = z
  .object({
    type: z.enum(TYPOLOGY_TYPES, { error: 'Veuillez sélectionner un type de logement' }),
    price_min: z.number({ error: 'Le loyer minimum est requis' }).min(0, 'Le loyer minimum doit être positif'),
    price_max: z.number({ error: 'Le loyer maximum est requis' }).min(0, 'Le loyer maximum doit être positif'),
    superficie_min: z.number({ error: 'La superficie minimum est requise' }).min(1, 'La superficie minimum doit être au moins 1 m²'),
    superficie_max: z.number({ error: 'La superficie maximum est requise' }).min(1, 'La superficie maximum doit être au moins 1 m²'),
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
    if (data.superficie_min != null && data.superficie_max != null && data.superficie_min > data.superficie_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La superficie minimum ne peut pas être supérieure à la superficie maximum',
        path: ['superficie_min'],
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
  superficie_min_t1: true,
  superficie_max_t1: true,
  nb_t1_bis: true,
  nb_t1_bis_available: true,
  price_min_t1_bis: true,
  price_max_t1_bis: true,
  superficie_min_t1_bis: true,
  superficie_max_t1_bis: true,
  nb_t2: true,
  nb_t2_available: true,
  price_min_t2: true,
  price_max_t2: true,
  superficie_min_t2: true,
  superficie_max_t2: true,
  nb_t3: true,
  nb_t3_available: true,
  price_min_t3: true,
  price_max_t3: true,
  superficie_min_t3: true,
  superficie_max_t3: true,
  nb_t4: true,
  nb_t4_available: true,
  price_min_t4: true,
  price_max_t4: true,
  superficie_min_t4: true,
  superficie_max_t4: true,
  nb_t5: true,
  nb_t5_available: true,
  price_min_t5: true,
  price_max_t5: true,
  superficie_min_t5: true,
  superficie_max_t5: true,
  nb_t6: true,
  nb_t6_available: true,
  price_min_t6: true,
  price_max_t6: true,
  superficie_min_t6: true,
  superficie_max_t6: true,
  nb_t7_more: true,
  nb_t7_more_available: true,
  price_min_t7_more: true,
  price_max_t7_more: true,
  superficie_min_t7_more: true,
  superficie_max_t7_more: true,
}).extend({
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postal_code: z.string().min(1, 'Le code postal est requis'),
  external_url: z.url('Veuillez saisir une URL valide').min(1, "L'URL de redirection est requise"),
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
    flat[`superficie_min_${key}`] = null
    flat[`superficie_max_${key}`] = null
  }

  for (const t of typologies) {
    const key = TYPE_TO_KEY[t.type]
    if (!key) continue
    flat[`nb_${key}`] = t.nb_total
    flat[`nb_${key}_available`] = t.nb_available
    flat[`price_min_${key}`] = t.price_min
    flat[`price_max_${key}`] = t.price_max
    flat[`superficie_min_${key}`] = t.superficie_min ?? null
    flat[`superficie_max_${key}`] = t.superficie_max ?? null
  }

  return flat
}
