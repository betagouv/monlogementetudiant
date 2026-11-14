import type { Task } from 'graphile-worker'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { syncAndUnblockManagers } from '~/server/services/brevo-unblock'

export const brevoUnblockManagersTask: Task = async () => {
  await withJobRun('brevo-unblock-managers', 'scheduled', async () => {
    const metrics = await syncAndUnblockManagers()
    await recordJobMetrics(metrics)
  })
}
