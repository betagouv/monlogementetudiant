import type { Task } from 'graphile-worker'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { syncBlockedManagers } from '~/server/services/brevo-unblock'

export const syncBrevoBlockedManagersTask: Task = async () => {
  await withJobRun('sync-brevo-blocked-managers', 'scheduled', async () => {
    const metrics = await syncBlockedManagers()
    await recordJobMetrics(metrics)
  })
}
