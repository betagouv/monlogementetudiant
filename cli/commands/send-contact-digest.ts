import { eq } from 'drizzle-orm'
import { runContactDigest } from '~/server/bailleur/contact-digest'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { env } from '~/server/env'
import { CronPartialFailure } from '../cron-failure'

interface SendContactDigestOptions {
  dryRun?: boolean
  verbose?: boolean
  owner?: string
}

export async function sendContactDigestCommand(options: SendContactDigestOptions): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !options.dryRun && !options.owner) {
    console.info(
      `[${env.NEXT_PUBLIC_APP_ENV}] send-contact-digest ignoré hors production (utilisez --dry-run pour simuler ou --owner pour cibler un bailleur)`,
    )
    return
  }

  console.log(`⏳ Récapitulatif quotidien des demandes de contact${options.owner ? ` (bailleur ${options.owner})` : ''}...`)

  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({
        type: 'contact-digest',
        status: 'running',
        source: 'contact-digest',
        createdBy: 'cron',
        startedAt: new Date(),
      })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { contacts, residences, recipients, failures } = await runContactDigest({
      dryRun: options.dryRun,
      verbose: options.verbose,
      ownerSlug: options.owner,
    })
    const prefix = options.dryRun ? '[dry-run] ' : ''

    console.log(`\n  ${prefix}Demandes de la veille : ${contacts}`)
    console.log(`  ${prefix}Résidences concernées : ${residences}`)
    console.log(`  ${prefix}Destinataires : ${recipients}`)
    if (options.dryRun) return

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { errors: failures, context: { contacts, residences, recipients } },
        })
        .where(eq(importJobs.id, jobId))
    }

    if (failures.length > 0) {
      throw new CronPartialFailure(`${failures.length} envoi(s) en échec pendant le récapitulatif des demandes`, failures)
    }
  } catch (error) {
    if (error instanceof CronPartialFailure) throw error
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Récapitulatif des demandes échoué : ${msg}`)
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
