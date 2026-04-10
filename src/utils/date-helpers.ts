import { format, formatDistanceToNow, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

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
