import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const createZResetPasswordForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .object({
      password: z.string().min(12, { message: t('errors.passwordMinLength') }),
      confirmPassword: z.string().min(12, { message: t('errors.passwordMinLength') }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('errors.passwordsMismatch'),
    })

export const ZResetPasswordForm = createZResetPasswordForm()

export type TResetPasswordForm = z.infer<typeof ZResetPasswordForm>
