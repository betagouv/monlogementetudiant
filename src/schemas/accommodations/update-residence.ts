import { z } from 'zod'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'
import { isValidVirtualTourInput } from '~/utils/virtual-tour'
import { createZTypologies } from './typology'

export const createZUpdateResidence = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    name: z.string().min(1, t('errors.residenceNameRequired')).optional(),
    residenceType: z.enum(EResidenceType, { error: t('errors.residenceTypeRequired') }).optional(),
    targetAudience: z.enum(ETargetAudience, { error: t('errors.targetAudienceRequired') }).optional(),
    addresses: z
      .array(
        z.object({
          address: z.string().min(1, t('errors.addressRequired')),
          city: z.string().min(1, t('errors.cityRequired')),
          postalCode: z.string().min(1, t('errors.postalCodeRequired')),
        }),
      )
      .min(1, t('errors.addressesRequired'))
      .optional(),
    description: z.string().optional(),
    rentalChargesDetails: z.string().optional(),
    externalUrl: z.url(t('errors.urlInvalid')).optional().or(z.literal('')),
    virtualTourUrl: z.string().max(2000).refine(isValidVirtualTourInput, t('errors.virtualTourNotAllowed')).optional(),

    acceptWaitingList: z.boolean().optional(),

    // Typologies as a structured array (validations live in ZTypology / ZTypologies).
    typologies: createZTypologies(t).optional(),

    nbAccessibleApartments: z
      .number()
      .int(t('errors.nbAccessibleApartmentsPositive'))
      .min(0, t('errors.nbAccessibleApartmentsPositive'))
      .nullish(),
    nbColivingApartments: z
      .number()
      .int(t('errors.nbColivingApartmentsPositive'))
      .min(0, t('errors.nbColivingApartmentsPositive'))
      .nullish(),

    refrigerator: z.boolean().optional(),
    laundryRoom: z.boolean().optional(),
    bathroom: z.enum(['private', 'shared']).optional(),
    kitchenType: z.enum(['private', 'shared']).optional(),
    microwave: z.boolean().optional(),
    secureAccess: z.boolean().optional(),
    parking: z.boolean().optional(),
    commonAreas: z.boolean().optional(),
    bikeStorage: z.boolean().optional(),
    desk: z.boolean().optional(),
    residenceManager: z.boolean().optional(),
    cookingPlates: z.boolean().optional(),
    wifi: z.boolean().optional(),
    imagesUrls: z.array(z.string().transform((url) => encodeURI(url))).optional(),

    published: z.boolean().optional(),
    scholarshipHoldersPriority: z.boolean().optional(),
    socialHousingRequired: z.boolean().optional(),
  })

export const ZUpdateResidence = createZUpdateResidence()

export type TUpdateResidence = z.infer<typeof ZUpdateResidence>
