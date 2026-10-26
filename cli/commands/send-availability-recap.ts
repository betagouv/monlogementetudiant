import { eq } from 'drizzle-orm'
import { runAvailabilityMonthlyRecap } from '~/server/bailleur/availability-recap'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { CronPartialFailure } from '../cron-failure'

interface SendAvailabilityRecapOptions {
  dryRun?: boolean
  verbose?: boolean
  owner?: string
}

export async function sendAvailabilityRecapCommand(options: SendAvailabilityRecapOptions): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !options.dryRun && !options.owner) {
    console.info(
      `[${env.NEXT_PUBLIC_APP_ENV}] send-availability-recap ignoré hors production (utilisez --dry-run pour simuler ou --owner pour cibler un bailleur)`,
    )
    return
  }

  console.log(`⏳ Récap mensuel des disponibilités${options.owner ? ` (bailleur ${options.owner})` : ''}...`)

  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({
        type: 'availability-recap',
        status: 'running',
        source: 'availability-recap',
        createdBy: 'cron',
        startedAt: new Date(),
      })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { residences, emails, failures } = await runAvailabilityMonthlyRecap({
      dryRun: options.dryRun,
      verbose: options.verbose,
      ownerSlug: options.owner,
      sendOutsideProduction: Boolean(options.owner),
    })
    const prefix = options.dryRun ? '[dry-run] ' : ''

    console.log(`\n  ${prefix}Résidences récapitulées : ${residences}`)
    console.log(`  ${prefix}E-mails envoyés : ${emails}`)
    if (options.dryRun) return

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { errors: failures, context: { residences, emails } },
        })
        .where(eq(importJobs.id, jobId))
    }

    if (failures.length > 0) {
      throw new CronPartialFailure(`${failures.length} e-mail(s) en échec pendant le récap mensuel des disponibilités`, failures)
    }
  } catch (error) {
    if (error instanceof CronPartialFailure) throw error
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Récap mensuel des disponibilités échoué : ${msg}`)
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
