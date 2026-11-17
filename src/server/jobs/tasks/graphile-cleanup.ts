import { makeWorkerUtils, type Task } from 'graphile-worker'
import { env } from '~/server/env'
import { JOB_IDENTIFIERS } from '~/server/jobs/enqueue'
import { markStaleCliRuns, withJobRun } from '~/server/jobs/job-run'

export async function cleanupGraphile(): Promise<void> {
  const utils = await makeWorkerUtils({ connectionString: env.DATABASE_URL, maxPoolSize: 1 })
  try {
    await utils.cleanup({
      tasks: ['DELETE_PERMAFAILED_JOBS', 'GC_JOB_QUEUES', 'GC_TASK_IDENTIFIERS'],
      taskIdentifiersToKeep: JOB_IDENTIFIERS,
    })
  } finally {
    await utils.release()
  }
}

export const graphileCleanupTask: Task = async () => {
  await withJobRun('graphile-cleanup', 'scheduled', async () => {
    await cleanupGraphile()
    const stale = await markStaleCliRuns()
    if (stale > 0) console.log(`graphile-cleanup : ${stale} commande(s) CLI orpheline(s) marquée(s) interrompue(s)`)
  })
}
