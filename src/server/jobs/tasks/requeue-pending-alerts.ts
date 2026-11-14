import { and, eq, lt, sql } from 'drizzle-orm'
import type { Task } from 'graphile-worker'
import { db } from '~/server/db'
import { alertJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { alertBatchJobKey, alertBatchKeyOf, enqueueAlertBatch, type TAlertBatchKey } from '~/server/services/alert-sender'

export async function requeuePendingAlerts(): Promise<number> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') return 0

  const rows = await db
    .selectDistinct({ source: alertJobs.source, userId: alertJobs.userId, studentAlertId: alertJobs.studentAlertId })
    .from(alertJobs)
    .where(and(eq(alertJobs.status, 'pending'), lt(alertJobs.createdAt, sql`now() - interval '10 minutes'`)))

  const batches = new Map<string, TAlertBatchKey>()
  for (const row of rows) {
    const key = alertBatchKeyOf(row)
    if (key) batches.set(alertBatchJobKey(key), key)
  }
  for (const key of batches.values()) await enqueueAlertBatch(db, key)
  return batches.size
}

export const requeuePendingAlertsTask: Task = async () => {
  await withJobRun('requeue-pending-alerts', 'scheduled', async () => {
    const requeued = await requeuePendingAlerts()
    await recordJobMetrics({ requeued })
  })
}
