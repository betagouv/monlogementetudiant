import { CronExpressionParser } from 'cron-parser'

export function nextRunAt(cron: string, from: Date): Date {
  return CronExpressionParser.parse(cron, { currentDate: from, tz: 'UTC' }).next().toDate()
}
