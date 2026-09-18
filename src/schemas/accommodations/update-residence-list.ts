import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'
import { TYPOLOGY_TYPES, type TypologyType } from './typology'

export const createZAvailabilityEntry = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    type: z.enum(TYPOLOGY_TYPES),
    nbAvailable: z
      .number({ message: t('errors.required') })
      .min(0, t('errors.nbAvailablePositive'))
      .nullable(),
  })

export const ZAvailabilityEntry = createZAvailabilityEntry()

export const createZUpdateResidenceList = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    availability: z.array(createZAvailabilityEntry(t)),
  })

export const ZUpdateResidenceList = createZUpdateResidenceList()

export type TUpdateResidenceList = z.infer<typeof ZUpdateResidenceList>

/** Validate availability against the existing per-type totals (available ≤ total). */
export const createUpdateResidenceListSchema = (
  existingTotals: Partial<Record<TypologyType, number | null>>,
  t: TSchemaTranslator = frSchemaTranslator,
) =>
  createZUpdateResidenceList(t).superRefine((data, ctx) => {
    data.availability.forEach((entry, i) => {
      const total = existingTotals[entry.type]
      const typology = t(`typologies.${entry.type}`)
      if (total == null && typeof entry.nbAvailable === 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('errors.availabilityTotalMissing', { typology }),
          path: ['availability', i, 'nbAvailable'],
        })
      }
      if (total != null && entry.nbAvailable != null && entry.nbAvailable > total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('errors.availabilityGreaterThanTotal', { typology, total }),
          path: ['availability', i, 'nbAvailable'],
        })
      }
    })
  })
