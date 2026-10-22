import { addDays, differenceInCalendarDays, differenceInYears, format, formatDistanceToNow, isValid, parseISO, subDays } from 'date-fns'
import { enUS, fr } from 'date-fns/locale'
import { AvailableLocales, resolveLocale } from '~/i18n/locales'

type DateInput = string | Date

const toDate = (value: DateInput): Date => (typeof value === 'string' ? parseISO(value) : value)

export function getYesterday(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd')
}

export function getDateFrom(daysAgo: number): string {
  return format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
}

export function formatChartDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM')
}

export function formatRelativeDate(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr })
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m${secs.toString().padStart(2, '0')}s`
}

export const formatLocalizedDate = (date: DateInput, formatString: string, locale?: string | null): string =>
  format(toDate(date), formatString, { locale: resolveLocale(locale) === AvailableLocales.EN ? enUS : fr })

export const formatIsoDate = (date: DateInput): string => format(toDate(date), 'yyyy-MM-dd')

/** Âge en années révolues, ou `null` si la date est absente/invalide. */
export const computeAge = (birthdate: DateInput | null | undefined): number | null => {
  if (!birthdate) return null
  const parsed = toDate(birthdate)
  if (!isValid(parsed)) return null
  const age = differenceInYears(new Date(), parsed)
  return age >= 0 ? age : null
}

/**
 * Nombre de jours restants avant l'échéance `from + durationDays`
 * (0 si l'échéance est passée), ou `null` si la date de départ est absente/invalide.
 */
export const daysLeftFrom = (from: DateInput | null | undefined, durationDays: number): number | null => {
  if (!from) return null
  const parsed = toDate(from)
  if (!isValid(parsed)) return null
  return Math.max(0, differenceInCalendarDays(addDays(parsed, durationDays), new Date()))
}
