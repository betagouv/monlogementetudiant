import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { expireStaleAlerts, sendExpiryReminders } from '~/server/services/alert-expiration'

interface ExpireAlertsOptions {
  dryRun?: boolean
  verbose?: boolean
}

export async function expireAlertsCommand(options: ExpireAlertsOptions): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !options.dryRun) {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] expire-alerts ignoré hors production (utilisez --dry-run pour simuler)`)
    return
  }

  console.log('⏳ Péremption des alertes logements...')

  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: 'alert-expiration', status: 'running', source: 'alert-expiration', createdBy: 'cron', startedAt: new Date() })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { reminded } = await sendExpiryReminders({ dryRun: options.dryRun, verbose: options.verbose })
    const { deactivated } = await expireStaleAlerts({ dryRun: options.dryRun, verbose: options.verbose })

    if (options.dryRun) {
      console.log(`\n  [dry-run] ${reminded} relance(s) auraient été envoyées`)
      console.log(`  [dry-run] ${deactivated} alerte(s) auraient été désactivées`)
      return
    }

    console.log(`\n  Relances envoyées : ${reminded}`)
    console.log(`  Alertes désactivées : ${deactivated}`)

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({ status: 'done', endedAt: new Date(), updatedAt: new Date(), summary: { context: { reminded, deactivated } } })
        .where(eq(importJobs.id, jobId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Péremption échouée : ${msg}`)
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
