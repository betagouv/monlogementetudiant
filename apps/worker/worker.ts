import { run } from 'graphile-worker'
import { closeDb } from '~/server/db'
import { env } from '~/server/env'
import { markInterruptedRuns } from '~/server/jobs/job-run'
import { buildCrontab, SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'
import { taskList } from '~/server/jobs/tasks'
import { initCliSentry } from './sentry'
import { reportWorkerJobError } from './worker-errors'

function graphileConnectionString(): string {
  const url = new URL(env.DATABASE_URL)
  url.searchParams.set('application_name', 'mle-worker-graphile')
  return url.toString()
}

async function main() {
  initCliSentry()

  try {
    const interrupted = await markInterruptedRuns()
    if (interrupted > 0) console.log(`Worker : ${interrupted} exécution(s) interrompue(s) marquée(s)`)
  } catch (error) {
    console.error('Worker : marquage des exécutions interrompues impossible', error)
  }

  const runner = await run({
    connectionString: graphileConnectionString(),
    maxPoolSize: 4,
    concurrency: 4,
    taskList,
    crontab: buildCrontab(),
    noHandleSignals: false,
  })
  runner.events.on('job:error', ({ job, error }) => {
    void reportWorkerJobError({ identifier: job.task_identifier, error, startedAt: job.locked_at ?? new Date() })
  })
  console.log(`Worker démarré : ${SCHEDULED_COMMANDS.length + SCHEDULED_IN_PROCESS.length} tâche(s) planifiée(s)`)

  await runner.promise
  await closeDb()
}

main().catch((error) => {
  console.error('Worker : arrêt sur erreur', error)
  process.exit(1)
})
