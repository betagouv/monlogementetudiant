import { z } from 'zod'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

/**
 * Calcule l'âge (en années) à partir d'une date ISO `YYYY-MM-DD`.
 */
const computeAge = (isoDate: string): number => {
  const today = new Date()
  const birth = new Date(isoDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

/**
 * Numéro de téléphone portable — validation internationale permissive.
 * Normalise (retire espaces, points, tirets, parenthèses) puis vérifie un
 * format E.164-like : `+` optionnel suivi de 6 à 15 chiffres.
 * La valeur retournée après parsing est normalisée (ex. `0601020304`).
 */
export const createZStudentPhone = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .string()
    .trim()
    .min(1, { message: t('errors.phoneRequired') })
    .transform((val) => val.replace(/[\s.\-()]/g, ''))
    .refine((val) => /^\+?\d{6,15}$/.test(val), { message: t('errors.phoneInvalid') })

export const ZStudentPhone = createZStudentPhone()

/**
 * Date de naissance — chaîne `YYYY-MM-DD` (valeur native d'un `<input type="date">`).
 * Vérifie le format, une date réelle, dans le passé, et un âge plausible (15–100 ans).
 */
export const createZBirthDate = (t: TSchemaTranslator = frSchemaTranslator) =>
  z
    .string()
    .min(1, { message: t('errors.birthdateRequired') })
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), { message: t('errors.birthdateFormat') })
    .refine((val) => !Number.isNaN(new Date(val).getTime()), { message: t('errors.dateInvalid') })
    .refine((val) => new Date(val) < new Date(), { message: t('errors.birthdateInPast') })
    .refine((val) => computeAge(val) >= 15, { message: t('errors.birthdateMinAge') })
    .refine((val) => computeAge(val) <= 100, { message: t('errors.birthdateInvalid') })

export const ZBirthDate = createZBirthDate()

/**
 * Statut boursier. « Je ne sais pas » (`unknown`) est une réponse valide.
 */
export const createZScholarshipStatus = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.enum(['yes', 'no', 'unknown'], { error: t('errors.scholarshipStatusRequired') })

export const ZScholarshipStatus = createZScholarshipStatus()

/**
 * Bloc d'informations étudiant partagé entre l'inscription et la modale de complétion.
 */
export const createZStudentProfileInfo = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    phone: createZStudentPhone(t),
    birthdate: createZBirthDate(t),
    scholarshipStatus: createZScholarshipStatus(t),
  })

export const ZStudentProfileInfo = createZStudentProfileInfo()

export type TStudentProfileInfo = z.infer<typeof ZStudentProfileInfo>
