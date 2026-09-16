import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZUpdateAlertRequest = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    name: z.string().min(1, t('errors.alertNameRequired')).optional(),
    cityId: z.number().optional(),
    departmentId: z.number().optional(),
    academyId: z.number().optional(),
    hasColiving: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    maxPrice: z.number().min(1, t('errors.alertMaxPricePositive')).optional(),
    id: z.number(),
    receiveNotifications: z.boolean().optional(),
  })

export const ZUpdateAlertRequest = createZUpdateAlertRequest()

export type TUpdateAlertRequest = z.infer<typeof ZUpdateAlertRequest>
