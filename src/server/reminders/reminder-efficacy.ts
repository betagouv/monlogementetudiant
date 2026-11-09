import { addMonths } from 'date-fns'
import { EReminderType, MEASURED_REMINDER_TYPES } from '~/enums/reminder-email'
import { CRON_RUN_TOLERANCE_MS, SUSPENSION_NOTICE_DAYS } from '~/server/bailleur/inactivity-rules'
import { DAY_MS } from '~/utils/time'

export type TReminderEfficacyStatus = 'effective' | 'failed' | 'pending' | 'not_measured'

export type TItemFacts = { resolvedAt: Date | null; failedAt: Date | null }

export function reminderDeadline(type: EReminderType, sentAt: Date): Date {
  if (type === EReminderType.AVAILABILITY_MONTHLY_RECAP) return addMonths(sentAt, 1)
  return new Date(sentAt.getTime() + SUSPENSION_NOTICE_DAYS * DAY_MS)
}

type TItemOutcome = 'resolved' | 'failed' | 'pending'

export function decideEfficacy({ type, sentAt, items, now }: { type: EReminderType; sentAt: Date; items: TItemFacts[]; now: Date }): {
  status: TReminderEfficacyStatus
  reactionMs: number | null
} {
  if (!MEASURED_REMINDER_TYPES.includes(type) || items.length === 0) return { status: 'not_measured', reactionMs: null }

  const deadline = reminderDeadline(type, sentAt).getTime()
  const within = (date: Date | null, tolerance = 0): date is Date => date !== null && date.getTime() <= deadline + tolerance
  const expired = now.getTime() > deadline

  const outcomeOf = (item: TItemFacts): TItemOutcome => {
    if (within(item.failedAt, CRON_RUN_TOLERANCE_MS)) return 'failed'
    if (within(item.resolvedAt)) return 'resolved'
    return expired ? 'failed' : 'pending'
  }

  const outcomes = items.map(outcomeOf)
  if (outcomes.includes('failed')) return { status: 'failed', reactionMs: null }
  if (outcomes.some((outcome) => outcome === 'pending')) return { status: 'pending', reactionMs: null }

  const lastResolved = Math.max(...items.map((item) => item.resolvedAt?.getTime() ?? 0))
  return { status: 'effective', reactionMs: lastResolved - sentAt.getTime() }
}
