import { computeAge } from '~/utils/date-helpers'

/** Âge maximum des résidences qui refusent les plus âgés (FJT, résidences jeunes actifs : « 30 ans maximum »). */
export const MAX_APPLICANT_AGE = 30

/** Vrai si la date de naissance dépasse l'âge maximum à la date de la demande (31 ans et plus). */
export const isOverMaxApplicantAge = (birthdate: string | null | undefined) => {
  const age = computeAge(birthdate)
  return age !== null && age > MAX_APPLICANT_AGE
}
