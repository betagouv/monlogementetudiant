import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'
import { createZStudentProfileInfo } from '~/schemas/student-profile/student-profile'

export const createZSignUpForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .object({
      firstname: z.string().min(1, { message: t('errors.firstnameRequired') }),
      lastname: z.string().min(1, { message: t('errors.lastnameRequired') }),
      email: z
        .string()
        .min(1, { message: t('errors.emailRequired') })
        .email({ message: t('errors.emailInvalid') }),
      password: z.string().min(12, { message: t('errors.passwordMinLengthWithRules') }),
    })
    .extend(createZStudentProfileInfo(t).shape)

export const ZSignUpForm = createZSignUpForm()

export type TSignUpForm = z.infer<typeof ZSignUpForm>
