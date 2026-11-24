import { z } from 'zod'

const MAX_MONTHS = 24

export const ZMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois invalide' })

const monthIndex = (month: string) => {
  const [year, m] = month.split('-').map(Number)
  return (year ?? 0) * 12 + (m ?? 1) - 1
}

export const ZMonthRange = z
  .object({ from: ZMonth, to: ZMonth })
  .refine((range) => range.from <= range.to, { message: 'La date de début doit précéder la date de fin', path: ['from'] })
  .refine((range) => monthIndex(range.to) - monthIndex(range.from) < MAX_MONTHS, {
    message: 'La période ne peut pas dépasser 24 mois',
    path: ['to'],
  })

export type TMonthRange = z.infer<typeof ZMonthRange>
