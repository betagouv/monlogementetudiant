import { z } from 'zod'

export enum EResidenceType {
  UNIVERSITAIRE_CONVENTIONNEE = 'universitaire-conventionnee',
  SOCIALE_JEUNES_ACTIFS = 'sociale-jeunes-actifs',
  INTERGENERATIONNELLE = 'intergenerationnelle',
  JEUNES_TRAVAILLEURS = 'jeunes-travailleurs',
  SOCIAL_FLECHE_JEUNE = 'social-fleche-jeune',
  SOCIAL_CLASSIQUE = 'social-classique',
  ECOLE = 'ecole',
  RESIDENCE_ETUDIANTE = 'residence-etudiante',
  SOUS_LOCATION = 'sous-location',
}

export const RESIDENCE_TYPE_LABELS: Record<EResidenceType, string> = {
  [EResidenceType.UNIVERSITAIRE_CONVENTIONNEE]: 'Résidence Universitaire conventionnée',
  [EResidenceType.SOCIALE_JEUNES_ACTIFS]: 'Résidence sociale Jeunes Actifs (RSJA, Habitat Jeunes)',
  [EResidenceType.INTERGENERATIONNELLE]: 'Cohabitation intergénérationnelle',
  [EResidenceType.JEUNES_TRAVAILLEURS]: 'Foyer Jeunes Travailleurs (FJT)',
  [EResidenceType.SOCIAL_FLECHE_JEUNE]: 'Logement social fléché vers les jeunes (loi ELAN - article 109)',
  [EResidenceType.SOCIAL_CLASSIQUE]: 'Logement social classique commercialisé en partie aux étudiants',
  [EResidenceType.ECOLE]: "Résidence d'école ou d'établissement d'enseignement",
  [EResidenceType.RESIDENCE_ETUDIANTE]: 'Résidence étudiante',
  [EResidenceType.SOUS_LOCATION]: 'Logements sociaux sous-loués aux étudiants par une association',
}

export enum ETargetAudience {
  ETUDIANTS = 'etudiants',
  MIXTE = 'mixte-etudiants-jeunes-actifs',
}

export const ZUpdateResidence = z.object({
  name: z.string().min(1, 'Le nom de la résidence est requis').optional(),
  residence_type: z.enum(EResidenceType, { error: 'La typologie de logements est requise' }).optional(),
  target_audience: z.enum(ETargetAudience, { error: 'Le public cible est requis' }).optional(),
  address: z.string().min(1, "L'adresse est requise").optional(),
  city: z.string().min(1, 'La ville est requise').optional(),
  postal_code: z.string().min(1, 'Le code postal est requis').optional(),
  description: z.string().optional(),
  external_url: z.url('Veuillez saisir une URL valide').optional().or(z.literal('')),

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

  nb_t4: z.number().min(0).nullish(),
  nb_t4_available: z.number().min(0).nullish(),
  price_min_t4: z.number().min(0).nullish(),
  price_max_t4: z.number().min(0).nullish(),

  nb_t5: z.number().min(0).nullish(),
  nb_t5_available: z.number().min(0).nullish(),
  price_min_t5: z.number().min(0).nullish(),
  price_max_t5: z.number().min(0).nullish(),

  nb_t6: z.number().min(0).nullish(),
  nb_t6_available: z.number().min(0).nullish(),
  price_min_t6: z.number().min(0).nullish(),
  price_max_t6: z.number().min(0).nullish(),

  nb_t7_more: z.number().min(0).nullish(),
  nb_t7_more_available: z.number().min(0).nullish(),
  price_min_t7_more: z.number().min(0).nullish(),
  price_max_t7_more: z.number().min(0).nullish(),

  nb_accessible_apartments: z.number().nullish(),
  nb_coliving_apartments: z.number().nullish(),

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
  images_urls: z.array(z.string().transform((url) => encodeURI(url))).optional(),

  published: z.boolean().optional(),
  scholarship_holders_priority: z.boolean().optional(),
})

// For validation with existing accommodation data
export const createUpdateResidenceSchema = (existingData: {
  nb_t1?: number | null
  nb_t1_bis?: number | null
  nb_t2?: number | null
  nb_t3?: number | null
  nb_t4?: number | null
  nb_t5?: number | null
  nb_t6?: number | null
  nb_t7_more?: number | null
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
        total: data.nb_t4 ?? existingData.nb_t4,
        available: data.nb_t4_available,
        availablePath: 'nb_t4_available',
        type: 'T4',
      },
      {
        total: data.nb_t5 ?? existingData.nb_t5,
        available: data.nb_t5_available,
        availablePath: 'nb_t5_available',
        type: 'T5',
      },
      {
        total: data.nb_t6 ?? existingData.nb_t6,
        available: data.nb_t6_available,
        availablePath: 'nb_t6_available',
        type: 'T6',
      },
      {
        total: data.nb_t7_more ?? existingData.nb_t7_more,
        available: data.nb_t7_more_available,
        availablePath: 'nb_t7_more_available',
        type: 'T7+',
      },
    ]

    for (const { total, available, availablePath, type } of validations) {
      if ((total === null || total === undefined) && typeof available === 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Veuillez d'abord renseigner le nombre total de logements ${type}`,
          path: [availablePath],
        })
      }
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
