import { describe, expect, it } from 'vitest'
import { EReminderType } from '~/enums/reminder-email'
import { DAY_MS } from '~/utils/time'
import { decideEfficacy } from './reminder-efficacy'

const sentAt = new Date('2026-10-01T05:00:00Z')
const after = (days: number) => new Date(sentAt.getTime() + days * DAY_MS)

describe('decideEfficacy', () => {
  it('récap résolu avant l’échéance : effective avec le délai de réaction', () => {
    const result = decideEfficacy({
      type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
      sentAt,
      items: [{ resolvedAt: new Date('2026-10-20T05:00:00Z'), failedAt: null }],
      now: new Date('2026-11-09T05:00:00Z'),
    })
    expect(result).toEqual({ status: 'effective', reactionMs: 19 * DAY_MS })
  })

  it('récap résolu après un mois : failed', () => {
    const result = decideEfficacy({
      type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
      sentAt,
      items: [{ resolvedAt: new Date('2026-11-02T05:00:00Z'), failedAt: null }],
      now: new Date('2026-11-09T05:00:00Z'),
    })
    expect(result).toEqual({ status: 'failed', reactionMs: null })
  })

  it('alerte sans résolution : pending puis failed après 7 jours', () => {
    const items = [{ resolvedAt: null, failedAt: null }]
    const type = EReminderType.AVAILABILITY_RESET_WARNING
    expect(decideEfficacy({ type, sentAt, items, now: after(3) }).status).toBe('pending')
    expect(decideEfficacy({ type, sentAt, items, now: after(8) }).status).toBe('failed')
  })

  it('alerte avec un item résolu et un item en échec : failed', () => {
    const result = decideEfficacy({
      type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
      sentAt,
      items: [
        { resolvedAt: after(1), failedAt: null },
        { resolvedAt: null, failedAt: after(7) },
      ],
      now: after(8),
    })
    expect(result.status).toBe('failed')
  })

  it('type non mesuré ou sans item : not_measured', () => {
    const items = [{ resolvedAt: after(1), failedAt: null }]
    expect(decideEfficacy({ type: EReminderType.AVAILABILITY_RESET_DONE, sentAt, items, now: after(2) }).status).toBe('not_measured')
    expect(decideEfficacy({ type: EReminderType.AVAILABILITY_RESET_WARNING, sentAt, items: [], now: after(2) }).status).toBe('not_measured')
  })
})
