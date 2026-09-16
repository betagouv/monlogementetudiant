import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZCreateAlertRequest = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .object({
      name: z.string().min(1, t('errors.alertNameRequired')),
      cityId: z.number().optional(),
      departmentId: z.number().optional(),
      academyId: z.number().optional(),
      hasColiving: z.boolean(),
      isAccessible: z.boolean(),
      maxPrice: z.number().min(1, t('errors.alertMaxPricePositive')),
    })
    .refine((data) => data.cityId != null || data.departmentId != null || data.academyId != null, {
      message: t('errors.alertTerritoryRequired'),
      path: ['cityId'],
    })

export const ZCreateAlertRequest = createZCreateAlertRequest()

export type TCreateAlertRequest = z.infer<typeof ZCreateAlertRequest>
