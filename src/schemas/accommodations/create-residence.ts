import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'
import { createZTypologies } from './typology'
import { createZUpdateResidence } from './update-residence'

export const createZCreateResidence = (t: TSchemaTranslator = frSchemaTranslator) =>
  createZUpdateResidence(t)
    .omit({ typologies: true })
    .extend({
      addresses: z
        .array(
          z.object({
            address: z.string().min(1, t('errors.addressRequired')),
            city: z.string().min(1, t('errors.cityRequired')),
            postalCode: z.string().min(1, t('errors.postalCodeRequired')),
          }),
        )
        .min(1, t('errors.addressesRequired')),
      externalUrl: z.url(t('errors.urlInvalid')).min(1, t('errors.externalUrlRequired')),
      imagesFiles: z.array(z.instanceof(File)).optional(),
      typologies: createZTypologies(t),
    })

export const ZCreateResidence = createZCreateResidence()

export type TCreateResidence = z.infer<typeof ZCreateResidence>

// Re-export the typology primitives from their shared module for existing import sites.
export {
  createZTypologies,
  createZTypology,
  getTypologyLabel,
  type TTypology,
  TYPOLOGIES,
  TYPOLOGY_TYPES,
  type TypologyType,
  ZTypologies,
  ZTypology,
} from './typology'
