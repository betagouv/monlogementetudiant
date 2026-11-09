import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { runGoalReminders } from '~/server/student/goal-reminders'
import { CronPartialFailure } from '../cron-failure'

interface SendGoalRemindersOptions {
  dryRun?: boolean
  verbose?: boolean
  force?: boolean
}

export async function sendGoalRemindersCommand(options: SendGoalRemindersOptions): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !options.dryRun && !options.force) {
    console.info(
      `[${env.NEXT_PUBLIC_APP_ENV}] send-goal-reminders ignoré hors production (utilisez --dry-run pour simuler ou --force pour envoyer)`,
    )
    return
  }

  console.log('⏳ Rappels des objectifs personnalisés arrivés à échéance...')

  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({
        type: 'goal-reminders',
        status: 'running',
        source: 'goal-reminders',
        createdBy: 'cron',
        startedAt: new Date(),
      })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { sent, failures } = await runGoalReminders({
      dryRun: options.dryRun,
      verbose: options.verbose,
      sendOutsideProduction: options.force,
    })
    const prefix = options.dryRun ? '[dry-run] ' : ''

    console.log(`\n  ${prefix}Rappels envoyés : ${sent}`)
    if (options.dryRun) return

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { errors: failures, context: { sent } },
        })
        .where(eq(importJobs.id, jobId))
    }

    if (failures.length > 0) {
      throw new CronPartialFailure(`${failures.length} envoi(s) en échec pendant les rappels d'objectifs`, failures)
    }
  } catch (error) {
    if (error instanceof CronPartialFailure) throw error
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Rappels d'objectifs échoués : ${msg}`)
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
