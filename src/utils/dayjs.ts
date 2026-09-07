import dayjs from 'dayjs'
import 'dayjs/locale/en'
import 'dayjs/locale/fr'

import { resolveLocale } from '~/i18n/locales'

export const formatDayjs = (date: dayjs.ConfigType, formatString: string, locale?: string | null) => {
  return dayjs(date).locale(resolveLocale(locale)).format(formatString)
}

/**
 * Date au format `YYYY-MM-DD`, dans le fuseau du serveur.
 *
 * À préférer à `toISOString().slice(0, 10)`, qui bascule sur la veille dès qu'on passe minuit en
 * heure française : un export lancé à 1 h du matin en été serait daté de la veille.
 */
export const formatIsoDate = (date: dayjs.ConfigType): string => dayjs(date).format('YYYY-MM-DD')

/** Âge en années révolues, ou `null` si la date est absente/invalide. */
export const computeAge = (birthdate: dayjs.ConfigType): number | null => {
  if (!birthdate) return null
  const parsed = dayjs(birthdate)
  if (!parsed.isValid()) return null
  const age = dayjs().diff(parsed, 'year')
  return age >= 0 ? age : null
}

/**
 * Nombre de jours restants avant l'échéance `from + durationDays`
 * (0 si l'échéance est passée), ou `null` si la date de départ est absente/invalide.
 */
export const daysLeftFrom = (from: dayjs.ConfigType, durationDays: number): number | null => {
  if (!from) return null
  const parsed = dayjs(from)
  if (!parsed.isValid()) return null
  return Math.max(0, parsed.add(durationDays, 'day').startOf('day').diff(dayjs().startOf('day'), 'day'))
}
