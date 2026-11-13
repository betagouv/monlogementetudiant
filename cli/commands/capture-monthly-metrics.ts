import { eq } from 'drizzle-orm'
import { captureMonthlyMetrics as runCapture } from '~/server/admin-metrics/capture'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'

interface CaptureMonthlyMetricsOptions {
  backfillMonths?: number
}

export async function captureMonthlyMetrics(options: CaptureMonthlyMetricsOptions): Promise<void> {
  const backfillMonths = options.backfillMonths ?? 0
  if (!Number.isInteger(backfillMonths) || backfillMonths < 0) {
    throw new Error('--backfill-months doit être un entier positif')
  }

  console.log('📊 Relevé des métriques mensuelles...')

  const [job] = await db
    .insert(importJobs)
    .values({ type: 'monthly-metrics', status: 'running', source: 'monthly-metrics', createdBy: 'cron', startedAt: new Date() })
    .returning({ id: importJobs.id })

  try {
    const { facts } = await runCapture({ backfillMonths })
    console.log(`  ${facts} candidature(s) recopiée(s) dans application_fact`)
    console.log(`  Mois relevés : mois courant + compteurs des ${Math.max(backfillMonths, 1)} mois précédent(s)`)

    await db
      .update(importJobs)
      .set({ status: 'done', endedAt: new Date(), updatedAt: new Date(), summary: { updated: facts, context: { backfillMonths } } })
      .where(eq(importJobs.id, job.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Relevé échoué : ${msg}`)
    await db
      .update(importJobs)
      .set({ status: 'error', endedAt: new Date(), updatedAt: new Date(), summary: { errors: [msg] } })
      .where(eq(importJobs.id, job.id))
    throw error
  } finally {
    await closeDb()
  }
}
