import { z } from 'zod'

const requiredNumber = (errorMessage: string) =>
  z.number({ error: errorMessage }).refine((val) => !Number.isNaN(val), { message: errorMessage })

export const helpSimulatorSchema = z.object({
  age: requiredNumber('Veuillez renseigner votre âge')
    .refine((val) => val >= 16, { message: 'Vous devez avoir au moins 16 ans' })
    .refine((val) => val <= 99, { message: 'Âge invalide' }),
  status: z.enum(['student', 'apprentice', 'employed-student'], { error: 'Veuillez sélectionner votre statut' }),
  monthlyIncome: requiredNumber('Veuillez renseigner vos revenus mensuels').refine((val) => val >= 0, {
    message: 'Le montant doit être positif',
  }),
  monthlyRent: z.number().or(z.nan()).optional(),
  rentUnknown: z.boolean().optional(),
  city: z.string({ error: 'Veuillez renseigner une ville' }).min(1, 'Veuillez renseigner une ville'),
  hasGuarantor: z.enum(['yes', 'no', 'unknown'], { error: 'Veuillez sélectionner votre situation' }),
  changingRegion: z.enum(['yes', 'no']).optional(),
  boursierLycee: z.enum(['yes', 'no']).optional(),
})

export type HelpSimulatorFormData = z.infer<typeof helpSimulatorSchema>

export const step1Schema = helpSimulatorSchema.pick({ age: true, status: true })

export const step2Schema = z.object({
  monthlyIncome: requiredNumber('Veuillez renseigner vos revenus mensuels').refine((val) => val >= 0, {
    message: 'Le montant doit être positif',
  }),
  monthlyRent: requiredNumber('Veuillez renseigner le montant de votre loyer').refine((val) => val >= 0, {
    message: 'Le montant doit être positif',
  }),
  rentUnknown: z.boolean().optional(),
})

export const step3Schema = helpSimulatorSchema.pick({ city: true, hasGuarantor: true, changingRegion: true, boursierLycee: true })
