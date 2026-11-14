import { and, eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { captureMonthlyMetrics } from '~/server/admin-metrics/capture'
import { getStudentSeries } from '~/server/admin-metrics/students'
import { alertJobs, monthlyMetrics } from '~/server/db/schema'
import { createAccommodation, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const NOW = new Date('2026-11-15T12:00:00Z')
const SEND_A = '11111111-1111-4111-8111-111111111111'
const SEND_B = '22222222-2222-4222-8222-222222222222'
const SEND_C = '33333333-3333-4333-8333-333333333333'

const ALERT_METRICS = [
  EMonthlyMetric.ALERT_EMAILS_SENT,
  EMonthlyMetric.ALERT_HOUSINGS_ALERT,
  EMonthlyMetric.ALERT_HOUSINGS_FAVORITE,
  EMonthlyMetric.ALERT_HOUSINGS_SIMILAR,
  EMonthlyMetric.ALERT_STUDENTS_NOTIFIED,
  EMonthlyMetric.ALERT_EMAILS_FAILED,
]

async function readAlertMetrics(month: string) {
  const rows = await getTestDb()
    .select({ metric: monthlyMetrics.metric, value: monthlyMetrics.value })
    .from(monthlyMetrics)
    .where(and(eq(monthlyMetrics.month, month), eq(monthlyMetrics.scope, 'global'), inArray(monthlyMetrics.metric, ALERT_METRICS)))
  return Object.fromEntries(rows.map((row) => [row.metric, row.value]))
}

async function accommodationIds(n: number) {
  const ids: number[] = []
  for (let i = 0; i < n; i++) ids.push((await createAccommodation()).id)
  return ids
}

describe('métriques d envoi des alertes', () => {
  it('compte mails, logements par source et étudiants prévenus', async () => {
    const db = getTestDb()
    await createUser({ id: 'a' })
    await createUser({ id: 'b' })
    const [a1, a2, a3, a4, a5] = await accommodationIds(5)
    const sentAt = new Date('2026-11-10T10:00:00Z')
    await db.insert(alertJobs).values([
      { userId: 'a', accommodationId: a1, source: 'alert', status: 'sent', sentAt, sendId: SEND_A },
      { userId: 'a', accommodationId: a2, source: 'alert', status: 'sent', sentAt, sendId: SEND_A },
      { userId: 'a', accommodationId: a3, source: 'similar', status: 'sent', sentAt, sendId: SEND_A },
      { userId: 'a', accommodationId: a4, source: 'favorite', status: 'sent', sentAt, sendId: SEND_B },
      { userId: 'a', accommodationId: a5, source: 'alert', status: 'pending' },
      { userId: 'b', accommodationId: a1, source: 'favorite', status: 'failed', attempts: 3, sendId: SEND_C, createdAt: sentAt },
      { userId: 'b', accommodationId: a2, source: 'favorite', status: 'failed', attempts: 3, sendId: SEND_C, createdAt: sentAt },
      { userId: 'b', accommodationId: a3, source: 'favorite', status: 'failed', attempts: 1, sendId: SEND_C, createdAt: sentAt },
    ])

    await captureMonthlyMetrics({ now: NOW })

    expect(await readAlertMetrics('2026-11')).toEqual({
      [EMonthlyMetric.ALERT_EMAILS_SENT]: 2,
      [EMonthlyMetric.ALERT_HOUSINGS_ALERT]: 2,
      [EMonthlyMetric.ALERT_HOUSINGS_SIMILAR]: 1,
      [EMonthlyMetric.ALERT_HOUSINGS_FAVORITE]: 1,
      [EMonthlyMetric.ALERT_STUDENTS_NOTIFIED]: 1,
      [EMonthlyMetric.ALERT_EMAILS_FAILED]: 1,
    })

    const series = Object.fromEntries((await getStudentSeries({ from: '2026-10', to: '2026-11' })).map((s) => [s.key, s.values]))
    expect(series.alert_emails_sent).toEqual([
      { month: '2026-10', total: 0, boursiers: null },
      { month: '2026-11', total: 2, boursiers: null },
    ])
    expect(series.alert_students_notified[1].total).toBe(1)
    expect(series.alert_emails_failed[1].total).toBe(1)
  })

  it('laisse le nombre de mails vide pour un mois sans identifiant d envoi', async () => {
    const db = getTestDb()
    await createUser({ id: 'a' })
    const [a1, a2] = await accommodationIds(2)
    const sentAt = new Date('2026-10-10T10:00:00Z')
    await db.insert(alertJobs).values([
      { userId: 'a', accommodationId: a1, source: 'alert', status: 'sent', sentAt },
      { userId: 'a', accommodationId: a2, source: 'alert', status: 'sent', sentAt },
    ])

    await captureMonthlyMetrics({ now: NOW, backfillMonths: 1 })

    const stored = await readAlertMetrics('2026-10')
    expect(stored[EMonthlyMetric.ALERT_HOUSINGS_ALERT]).toBe(2)
    expect(stored[EMonthlyMetric.ALERT_EMAILS_SENT]).toBeUndefined()

    const series = Object.fromEntries((await getStudentSeries({ from: '2026-10', to: '2026-11' })).map((s) => [s.key, s.values]))
    expect(series.alert_emails_sent).toEqual([
      { month: '2026-10', total: null, boursiers: null },
      { month: '2026-11', total: 0, boursiers: null },
    ])
    expect(series.alert_housings_alert[0].total).toBe(2)
  })
})
