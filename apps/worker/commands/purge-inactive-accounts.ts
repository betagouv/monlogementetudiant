import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import { INACTIVE_ACCOUNT_RETENTION_MONTHS, purgeInactiveAccounts as runPurge } from '~/server/users/purge-inactive'

interface PurgeInactiveAccountsOptions {
  dryRun?: boolean
}

export async function purgeInactiveAccounts(options: PurgeInactiveAccountsOptions): Promise<void> {
  console.log('🧹 Purge des comptes étudiants inactifs...')

  // Suivi du run dans import_jobs (visible dans l'admin « Tâches planifiées »). Pas de trace
  // en dry-run (rien n'est écrit).
  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({
        type: 'purge-inactive-accounts',
        status: 'running',
        source: 'purge-inactive-accounts',
        createdBy: 'cron',
        startedAt: new Date(),
      })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { purged } = await runPurge({ dryRun: options.dryRun })
    const prefix = options.dryRun ? '  [dry-run]' : ' '

    console.log(`${prefix} ${purged} compte(s) étudiant(s) sans connexion depuis ${INACTIVE_ACCOUNT_RETENTION_MONTHS} mois supprimé(s)`)

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({ status: 'done', endedAt: new Date(), updatedAt: new Date(), summary: { purged } })
        .where(eq(importJobs.id, jobId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Purge échouée : ${msg}`)
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
