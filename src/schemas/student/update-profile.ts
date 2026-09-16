import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const SCHOLARSHIP_TYPES = ['crous_social', 'crous_annual_specific', 'french_government', 'health_social_training', 'other'] as const

export const createZUpdateStudentProfileInput = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    firstname: z
      .string()
      .min(1, { message: t('errors.firstnameRequired') })
      .regex(/^[a-zA-ZÀ-ÿ\s\-]+$/, { message: t('errors.lettersOnly') }),
    lastname: z
      .string()
      .min(1, { message: t('errors.lastnameRequired') })
      .regex(/^[a-zA-ZÀ-ÿ\s\-]+$/, { message: t('errors.lettersOnly') }),
    phone: z
      .string()
      .regex(/^0[1-9][0-9]{8}$/, { message: t('errors.phoneInvalidWithExample') })
      .or(z.literal(''))
      .nullable()
      .optional(),
    birthdate: z.string().nullable().optional(),
    scholarshipStatus: z.enum(['yes', 'no', 'unknown']).nullable().optional(),
    scholarshipType: z.enum(SCHOLARSHIP_TYPES).nullable().optional(),
  })

export const ZUpdateStudentProfileInput = createZUpdateStudentProfileInput()

export type TUpdateStudentProfileInput = z.infer<typeof ZUpdateStudentProfileInput>

export const createZUpdateStudentProfileForm = (t: TSchemaTranslator = frSchemaTranslator) =>
  createZUpdateStudentProfileInput(t)
    .extend({
      currentPassword: z.string().optional(),
      newPassword: z.string().optional(),
      confirmPassword: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.scholarshipStatus === 'yes' && !data.scholarshipType) {
        ctx.addIssue({ code: 'custom', path: ['scholarshipType'], message: t('errors.scholarshipTypeRequired') })
      }

      if (!data.newPassword) return

      if (!data.currentPassword) {
        ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: t('errors.currentPasswordRequired') })
      }
      if (data.newPassword.length < 12) {
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message: t('errors.newPasswordMinLength') })
      }
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: t('errors.passwordsMismatch') })
      }
    })

export const ZUpdateStudentProfileForm = createZUpdateStudentProfileForm()

export type TUpdateStudentProfileForm = z.infer<typeof ZUpdateStudentProfileForm>
