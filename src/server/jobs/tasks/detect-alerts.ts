import type { Task } from 'graphile-worker'
import { z } from 'zod'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { detectAlertJobs } from '~/server/services/alert-detector'

const ZDetectAlertsPayload = z.object({ accommodationIds: z.array(z.number().int().positive()) })

export const detectAlertsTask: Task = async (payload) => {
  const { accommodationIds } = ZDetectAlertsPayload.parse(payload)
  await withJobRun('detect-alerts', 'event', async () => {
    const { triggered, jobsCreated } = await detectAlertJobs({ accommodationIds })
    await recordJobMetrics({ triggered, jobsCreated })
  })
}
