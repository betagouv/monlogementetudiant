import { addMonths, format } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { type AnyColumn, type SQL, sql } from 'drizzle-orm'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'

export type TMonth = string

const PARIS = 'Europe/Paris'

const parseMonth = (month: TMonth) => new Date(`${month}-01T00:00:00`)

export const listMonths = ({ from, to }: TMonthRange): TMonth[] => {
  const months: TMonth[] = []
  const end = parseMonth(to)
  for (let cursor = parseMonth(from); cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(format(cursor, 'yyyy-MM'))
  }
  return months
}

export const monthStart = (month: TMonth): Date => fromZonedTime(`${month}-01T00:00:00`, PARIS)

export const monthOf = (column: AnyColumn | SQL): SQL<string> =>
  sql<string>`to_char(date_trunc('month', ${column} at time zone 'Europe/Paris'), 'YYYY-MM')`

export const share = (part: number | null, total: number | null): number | null => {
  if (part === null || !total) return null
  return part / total
}

export const defaultMonthRange = (now: Date = new Date()): TMonthRange => {
  const current = toZonedTime(now, PARIS)
  const start = new Date(current.getFullYear(), current.getMonth(), 1)
  return { from: format(addMonths(start, -11), 'yyyy-MM'), to: format(start, 'yyyy-MM') }
}
