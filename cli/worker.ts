import { run } from 'graphile-worker'
import { closeDb } from '~/server/db'
import { env } from '~/server/env'
import { markInterruptedRuns } from '~/server/jobs/job-run'
import { buildCrontab, SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'
import { taskList } from '~/server/jobs/tasks'

function graphileConnectionString(): string {
  const url = new URL(env.DATABASE_URL)
  url.searchParams.set('application_name', 'mle-worker-graphile')
  return url.toString()
}

async function main() {
  const interrupted = await markInterruptedRuns()
  if (interrupted > 0) console.log(`Worker : ${interrupted} exécution(s) interrompue(s) marquée(s)`)

  const runner = await run({
    connectionString: graphileConnectionString(),
    maxPoolSize: 2,
    concurrency: 4,
    taskList,
    crontab: buildCrontab(),
    noHandleSignals: false,
  })
  console.log(`Worker démarré : ${SCHEDULED_COMMANDS.length + SCHEDULED_IN_PROCESS.length} tâche(s) planifiée(s)`)

  await runner.promise
  await closeDb()
}

main().catch((error) => {
  console.error('Worker : arrêt sur erreur', error)
  process.exit(1)
})
