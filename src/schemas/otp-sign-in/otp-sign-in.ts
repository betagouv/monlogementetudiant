import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZOtpSignInForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, { message: t('errors.otpInvalid') }),
  })

export const ZOtpSignInForm = createZOtpSignInForm()

export type TOtpSignInForm = z.infer<typeof ZOtpSignInForm>
