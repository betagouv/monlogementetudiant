import { z } from 'zod'

export type THelpSimulatorErrorKey =
  | 'ageRequired'
  | 'ageMin'
  | 'ageInvalid'
  | 'statusRequired'
  | 'monthlyIncomeRequired'
  | 'monthlyRentRequired'
  | 'amountPositive'
  | 'cityRequired'
  | 'guarantorRequired'
  | 'scholarshipRequired'
  | 'changingRegionRequired'
  | 'professionalLicenceRequired'

type TTranslateError = (key: THelpSimulatorErrorKey) => string

/**
 * Les messages d'erreur sont affichés tels quels dans le formulaire : le client construit les schémas
 * avec `t` (namespace `simulator.form.errors`). Sans traducteur (serveur, relecture du localStorage),
 * le message vaut la clé de traduction.
 */
export const createHelpSimulatorSchemas = (translate: TTranslateError = (key) => key) => {
  const requiredNumber = (key: THelpSimulatorErrorKey) => {
    const message = translate(key)
    return z.number({ error: message }).refine((val) => !Number.isNaN(val), { message })
  }

  const helpSimulatorSchema = z.object({
    age: requiredNumber('ageRequired')
      .refine((val) => val >= 16, { message: translate('ageMin') })
      .refine((val) => val <= 99, { message: translate('ageInvalid') }),
    status: z
      .array(z.enum(['student', 'apprentice', 'employed-student', 'lyceen', 'boursier-crous']))
      .min(1, { message: translate('statusRequired') }),
    isInternationalStudent: z.boolean().optional(),
    currentYear: z.enum(['terminale', 'licence3', 'other']).optional(),
    isProfessionalLicence: z.enum(['yes', 'no', 'unknown']).optional(),
    scholarship: z.enum(['bourse-lycee', 'bourse-crous', 'allocation-speciale', 'non']).optional(),
    monthlyIncome: requiredNumber('monthlyIncomeRequired').refine((val) => val >= 0, {
      message: translate('amountPositive'),
    }),
    monthlyRent: z.number().or(z.nan()).optional(),
    rentUnknown: z.boolean().optional(),
    city: z.string({ error: translate('cityRequired') }).min(1, translate('cityRequired')),
    hasGuarantor: z.enum(['yes', 'no', 'unknown'], { error: translate('guarantorRequired') }),
    changingRegion: z.enum(['yes', 'no', 'unknown']).optional(),
  })

  const step1Schema = helpSimulatorSchema
    .pick({
      age: true,
      status: true,
      isInternationalStudent: true,
      currentYear: true,
      isProfessionalLicence: true,
      scholarship: true,
      changingRegion: true,
    })
    .superRefine((data, ctx) => {
      const isMobilityCandidate = data.currentYear === 'terminale' || data.currentYear === 'licence3'

      if (isMobilityCandidate) {
        if (!data.scholarship) {
          ctx.addIssue({ code: 'custom', message: translate('scholarshipRequired'), path: ['scholarship'] })
        }
        if (!data.changingRegion) {
          ctx.addIssue({
            code: 'custom',
            message: translate('changingRegionRequired'),
            path: ['changingRegion'],
          })
        }
        if (data.currentYear === 'licence3' && !data.isProfessionalLicence) {
          ctx.addIssue({
            code: 'custom',
            message: translate('professionalLicenceRequired'),
            path: ['isProfessionalLicence'],
          })
        }
      }
    })

  const step2Schema = z.object({
    monthlyIncome: requiredNumber('monthlyIncomeRequired').refine((val) => val >= 0, {
      message: translate('amountPositive'),
    }),
    monthlyRent: requiredNumber('monthlyRentRequired').refine((val) => val >= 0, {
      message: translate('amountPositive'),
    }),
    rentUnknown: z.boolean().optional(),
  })

  const step3Schema = helpSimulatorSchema.pick({ city: true, hasGuarantor: true })

  return { helpSimulatorSchema, step1Schema, step2Schema, step3Schema }
}

export const { helpSimulatorSchema } = createHelpSimulatorSchemas()

export type HelpSimulatorFormData = z.infer<typeof helpSimulatorSchema>
