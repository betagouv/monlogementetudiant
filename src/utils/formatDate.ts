import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export const dateFormatter =
  (formatString: string) =>
  (date: Date): string =>
    format(date, formatString)

export const dateAsDay = dateFormatter('dd/MM/yyyy')

export const dateAsDayAndTime = dateFormatter("dd/MM/yyyy HH'h'mm")

export const dateAsTime = dateFormatter("HH'h'mm")

export const dateAsDayAndTimeInTimeZone = (date: Date, timezone: string) => formatInTimeZone(date, timezone, "dd/MM/yyyy HH'h'mm")

export const dateAsTimeInTimeZone = (date: Date, timezone: string) => formatInTimeZone(date, timezone, "HH'h'mm")

export const dateAsDayInTimeZone = (date: Date, timezone: string) => formatInTimeZone(date, timezone, 'dd.MM.yyyy')

export const dateAsDayConventionalInTimeZone = (date: Date, timezone: string) => formatInTimeZone(date, timezone, 'dd/MM/yyyy')

export const DEFAULT_TIMEZONE = 'Europe/Paris'

export const formatDateTime = (date: Date) => dateAsDayAndTimeInTimeZone(date, DEFAULT_TIMEZONE)

export const formatDay = (date: Date) => dateAsDayConventionalInTimeZone(date, DEFAULT_TIMEZONE)
