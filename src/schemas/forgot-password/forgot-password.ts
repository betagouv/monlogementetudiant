import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZForgotPasswordForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    email: z
      .string()
      .min(1, { message: t('errors.emailRequired') })
      .email({ message: t('errors.emailInvalid') }),
  })

export const ZForgotPasswordForm = createZForgotPasswordForm()

export type TForgotPasswordForm = z.infer<typeof ZForgotPasswordForm>
