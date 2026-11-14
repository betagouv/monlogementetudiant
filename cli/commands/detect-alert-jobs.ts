import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { recordJobMetrics } from '~/server/jobs/job-run'
import { detectAlertJobs } from '~/server/services/alert-detector'

interface DetectAlertJobsOptions {
  dryRun?: boolean
  verbose?: boolean
}

export async function detectAlertJobsCommand(options: DetectAlertJobsOptions): Promise<void> {
  console.log('🔎 Détection des hausses de disponibilité...')

  // Suivi du run dans import_jobs (visible dans l'admin « Tâches planifiées »). Pas de trace
  // en dry-run (rien n'est écrit).
  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: 'alert-detection', status: 'running', source: 'alert-detection', createdBy: 'cron', startedAt: new Date() })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const result = await detectAlertJobs({ dryRun: options.dryRun, verbose: options.verbose })

    if (options.dryRun) {
      console.log(`\n  [dry-run] ${result.triggered} hausse(s) détectée(s)`)
      console.log(`  [dry-run] ${result.jobsCreated} job(s) d'alerte auraient été créés`)
      return
    }

    console.log(`\n  Résidences enregistrées (baseline) : ${result.seeded}`)
    console.log(`  Hausses détectées : ${result.triggered}`)
    console.log(`  Jobs créés : ${result.jobsCreated}`)
    try {
      await recordJobMetrics({ triggered: result.triggered, jobsCreated: result.jobsCreated, seeded: result.seeded })
    } catch (error) {
      console.error('  ⚠️ Enregistrement des métriques impossible :', error instanceof Error ? error.message : String(error))
    }

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { context: { triggered: result.triggered, jobsCreated: result.jobsCreated, seeded: result.seeded } },
        })
        .where(eq(importJobs.id, jobId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Détection échouée : ${msg}`)
    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({ status: 'error', endedAt: new Date(), updatedAt: new Date(), summary: { errors: [msg] } })
        .where(eq(importJobs.id, jobId))
    }
    throw error
  } finally {
    await closeDb()
  }
}
