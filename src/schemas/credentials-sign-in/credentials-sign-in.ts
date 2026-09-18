import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZCredentialsSignInForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    email: z
      .string()
      .min(1, { message: t('errors.emailRequired') })
      .email({ message: t('errors.emailInvalid') }),
    password: z.string().min(1, { message: t('errors.passwordRequired') }),
  })

export const ZCredentialsSignInForm = createZCredentialsSignInForm()

export type TCredentialsSignInForm = z.infer<typeof ZCredentialsSignInForm>
