import { and, eq, gte, inArray, isNull } from 'drizzle-orm'
import type { Task } from 'graphile-worker'
import { db } from '~/server/db'
import { alertJobs } from '~/server/db/schema'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { MAX_ATTEMPTS } from '~/server/services/alert-sender'
import { CronPartialFailure, notifyCronFailure } from '../../../../cli/cron-failure'

export async function reportAlertFailures(startedAt: Date = new Date()): Promise<number> {
  const rows = await db
    .select({ id: alertJobs.id, source: alertJobs.source, studentAlertId: alertJobs.studentAlertId, error: alertJobs.error })
    .from(alertJobs)
    .where(and(eq(alertJobs.status, 'failed'), gte(alertJobs.attempts, MAX_ATTEMPTS), isNull(alertJobs.failureReportedAt)))
    .orderBy(alertJobs.id)

  if (rows.length === 0) return 0

  const details = rows.map((row) => {
    const batch = row.source === 'favorite' ? 'favoris' : `alerte ${row.studentAlertId}`
    return `alert_job ${row.id} (${batch}) : ${row.error ?? 'erreur inconnue'}`
  })
  await notifyCronFailure({
    job: 'send-alert-batch',
    error: new CronPartialFailure(`${rows.length} alerte(s) définitivement non envoyée(s) après ${MAX_ATTEMPTS} tentatives`, details),
    startedAt,
  })
  await db
    .update(alertJobs)
    .set({ failureReportedAt: new Date() })
    .where(
      inArray(
        alertJobs.id,
        rows.map((row) => row.id),
      ),
    )
  return rows.length
}

export const reportAlertFailuresTask: Task = async () => {
  const startedAt = new Date()
  await withJobRun('report-alert-failures', 'scheduled', async () => {
    const reported = await reportAlertFailures(startedAt)
    await recordJobMetrics({ reported })
  })
}
