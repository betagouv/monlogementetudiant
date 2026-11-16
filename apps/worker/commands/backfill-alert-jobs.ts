import { closeDb } from '~/server/db'
import { backfillAlertJobs } from '~/server/services/alert-detector'

interface BackfillAlertJobsOptions {
  dryRun?: boolean
  verbose?: boolean
}

export async function backfillAlertJobsCommand(options: BackfillAlertJobsOptions): Promise<void> {
  console.log('📨 Backfill : enfilage des jobs pour les alertes existantes (stock déjà disponible)...')

  try {
    const { alertsProcessed, jobsCreated } = await backfillAlertJobs({ dryRun: options.dryRun, verbose: options.verbose })

    if (options.dryRun) {
      console.log(`\n  [dry-run] ${alertsProcessed} alerte(s) actives, ${jobsCreated} job(s) auraient été enfilés`)
      return
    }

    console.log(`\n  ✅ ${alertsProcessed} alerte(s) actives traitées, ${jobsCreated} job(s) enfilés`)
  } catch (error) {
    console.error(`\n❌ Backfill échoué : ${error instanceof Error ? error.message : String(error)}`)
    throw error
  } finally {
    await closeDb()
  }
}
