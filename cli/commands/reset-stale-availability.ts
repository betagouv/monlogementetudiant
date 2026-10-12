import { eq } from 'drizzle-orm'
import { runStaleAvailabilityReset } from '~/server/bailleur/stale-availability-reset'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { CronPartialFailure } from '../cron-failure'

interface ResetStaleAvailabilityOptions {
  dryRun?: boolean
  verbose?: boolean
  owner?: string
}

export async function resetStaleAvailabilityCommand(options: ResetStaleAvailabilityOptions): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !options.dryRun && !options.owner) {
    console.info(
      `[${env.NEXT_PUBLIC_APP_ENV}] reset-stale-availability ignoré hors production (utilisez --dry-run pour simuler ou --owner pour cibler un bailleur)`,
    )
    return
  }

  console.log(`⏳ Disponibilités non mises à jour${options.owner ? ` (bailleur ${options.owner})` : ''}...`)

  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({
        type: 'availability-reset',
        status: 'running',
        source: 'availability-reset',
        createdBy: 'cron',
        startedAt: new Date(),
      })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { warned, reset, cleared, failures } = await runStaleAvailabilityReset({
      dryRun: options.dryRun,
      verbose: options.verbose,
      ownerSlug: options.owner,
      sendOutsideProduction: Boolean(options.owner),
    })
    const prefix = options.dryRun ? '[dry-run] ' : ''

    console.log(`\n  ${prefix}Résidences alertées : ${warned}`)
    console.log(`  ${prefix}Résidences repassées en « non communiquée » : ${reset}`)
    console.log(`  ${prefix}Alertes levées : ${cleared}`)
    if (options.dryRun) return

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { errors: failures, context: { warned, reset, cleared } },
        })
        .where(eq(importJobs.id, jobId))
    }

    if (failures.length > 0) {
      throw new CronPartialFailure(`${failures.length} opération(s) en échec pendant le suivi des disponibilités`, failures)
    }
  } catch (error) {
    if (error instanceof CronPartialFailure) throw error
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Réinitialisation des disponibilités échouée : ${msg}`)
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
