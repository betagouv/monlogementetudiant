import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZOtpCode = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.string().regex(/^\d{6}$/, { message: t('errors.otpInvalid') })

export const ZOtpCode = createZOtpCode()

export type TOtpCode = z.infer<typeof ZOtpCode>
