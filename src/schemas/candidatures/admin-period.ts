import { z } from 'zod'

const ZIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide, format attendu : AAAA-MM-JJ' })

/** Période de dépôt des candidatures, bornes incluses. */
export const ZAdminCandidaturesPeriod = z
  .object({ from: ZIsoDate, to: ZIsoDate })
  .refine(({ from, to }) => from <= to, { message: 'La date de début doit précéder la date de fin', path: ['to'] })

export type TAdminCandidaturesPeriod = z.infer<typeof ZAdminCandidaturesPeriod>
