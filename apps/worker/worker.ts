import { run } from 'graphile-worker'
import { closeDb, db } from '~/server/db'
import { env } from '~/server/env'
import { markInterruptedRuns } from '~/server/jobs/job-run'
import { buildCrontab, SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'
import { releaseLocksTakenBefore } from '~/server/jobs/stale-locks'
import { taskList } from '~/server/jobs/tasks'
import { initCliSentry } from './sentry'
import { waitForMigrations } from './wait-for-migrations'
import { reportWorkerFatalError, reportWorkerJobError } from './worker-errors'

const processStartedAt = new Date()

// Laisse à l'instance précédente (déploiement) le temps de s'arrêter avant de récupérer ses verrous.
const STALE_LOCKS_DELAY_MS = 60_000

function graphileConnectionString(): string {
  const url = new URL(env.DATABASE_URL)
  url.searchParams.set('application_name', 'mle-worker-graphile')
  return url.toString()
}

async function main() {
  initCliSentry()
  await waitForMigrations()

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
  setTimeout(() => {
    releaseLocksTakenBefore(db, processStartedAt)
      .then((owners) => {
        if (owners.length > 0) console.log(`Worker : verrous d'instances précédentes libérés (${owners.join(', ')})`)
      })
      .catch((error) => {
        console.error('Worker : libération des verrous orphelins impossible', error)
        void reportWorkerJobError({ identifier: 'worker', error, startedAt: processStartedAt })
      })
  }, STALE_LOCKS_DELAY_MS).unref()

  await runner.promise
  await closeDb()
}

const startedAt = new Date()

main().catch(async (error) => {
  console.error('Worker : arrêt sur erreur', error)
  await reportWorkerFatalError(error, startedAt)
  process.exit(1)
})
