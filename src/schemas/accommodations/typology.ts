import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

// Typologies — le `type` EST le suffixe (t1, t1_bis, …), aligné sur l'enum DB
// `accommodation_typology_type`, sur les clés de l'objet `typologies` exposé en réponse,
// et sur l'`apartmentType` de DossierFacile. Aucun mapping type↔suffixe nécessaire.
export const TYPOLOGIES = [
  { type: 't1', label: 'Studio T1' },
  { type: 't1_bis', label: 'Studio T1 bis' },
  { type: 't2', label: 'Logement T2' },
  { type: 't3', label: 'Logement T3' },
  { type: 't4', label: 'Logement T4' },
  { type: 't5', label: 'Logement T5' },
  { type: 't6', label: 'Logement T6' },
  { type: 't7_more', label: 'Logement T7+' },
] as const

export type TypologyType = (typeof TYPOLOGIES)[number]['type']

export const TYPOLOGY_TYPES = TYPOLOGIES.map((t) => t.type) as unknown as readonly [TypologyType, ...TypologyType[]]

export const getTypologyLabel = (type: string): string => TYPOLOGIES.find((t) => t.type === type)?.label ?? type

// Les colonnes numériques de `accommodation_typology` sont toutes nullables : une typologie
// peut être incomplète (import CSV partiel, saisie en plusieurs fois). Les bornes ne
// s'appliquent donc qu'aux valeurs effectivement renseignées, jamais à null/undefined.
export const createZTypology = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .object({
      type: z.enum(TYPOLOGY_TYPES, { error: t('errors.typologyTypeRequired') }),
      priceMin: z
        .number({ error: t('errors.priceMinNumber') })
        .min(0, t('errors.priceMinPositive'))
        .nullish(),
      priceMax: z
        .number({ error: t('errors.priceMaxNumber') })
        .min(0, t('errors.priceMaxPositive'))
        .nullish(),
      superficieMin: z
        .number({ error: t('errors.superficieMinNumber') })
        .min(1, t('errors.superficieMinAtLeastOne'))
        .nullish(),
      superficieMax: z
        .number({ error: t('errors.superficieMaxNumber') })
        .min(1, t('errors.superficieMaxAtLeastOne'))
        .nullish(),
      colocation: z.boolean(),
      nbTotal: z
        .number({ error: t('errors.nbTotalNumber') })
        .min(1, t('errors.nbTotalAtLeastOne'))
        .nullish(),
      nbAvailable: z
        .number({ error: t('errors.nbAvailableNumber') })
        .min(0, t('errors.nbAvailablePositive'))
        .nullish(),
    })
    .superRefine((data, ctx) => {
      if (data.priceMin != null && data.priceMax != null && data.priceMin > data.priceMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('errors.priceMinGreaterThanMax'),
          path: ['priceMin'],
        })
      }
      if (data.superficieMin != null && data.superficieMax != null && data.superficieMin > data.superficieMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('errors.superficieMinGreaterThanMax'),
          path: ['superficieMin'],
        })
      }
      if (data.nbAvailable != null && data.nbTotal != null && data.nbAvailable > data.nbTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('errors.nbAvailableGreaterThanTotal', { total: data.nbTotal }),
          path: ['nbAvailable'],
        })
      }
    })

export const ZTypology = createZTypology()

export type TTypology = z.infer<typeof ZTypology>

/** Validate a typologies array: at least one, and no duplicate type. */
export const createZTypologies = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .array(createZTypology(t))
    .min(1, t('errors.typologiesRequired'))
    .superRefine((typologies, ctx) => {
      const seen = new Set<string>()
      typologies.forEach((typology, i) => {
        if (seen.has(typology.type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('errors.typologyDuplicate', { typology: t(`typologies.${typology.type}`) }),
            path: [i, 'type'],
          })
        }
        seen.add(typology.type)
      })
    })

export const ZTypologies = createZTypologies()
