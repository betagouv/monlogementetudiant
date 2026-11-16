import { eq } from 'drizzle-orm'
import { CONTACT_RETENTION_DAYS, UNCONFIRMED_CONTACT_RETENTION_DAYS } from '~/enums/contact-status'
import { purgeContactRequests as runPurge } from '~/server/contacts/purge'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'

interface PurgeContactRequestsOptions {
  dryRun?: boolean
}

export async function purgeContactRequests(options: PurgeContactRequestsOptions): Promise<void> {
  console.log('🧹 Purge des demandes de contact...')

  // Suivi du run dans import_jobs (visible dans l'admin « Tâches planifiées »). Pas de trace
  // en dry-run (rien n'est écrit).
  let jobId: number | null = null
  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: 'purge-contacts', status: 'running', source: 'purge-contacts', createdBy: 'cron', startedAt: new Date() })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const { deleted, anonymized, dossiersPurged } = await runPurge({ dryRun: options.dryRun })
    const prefix = options.dryRun ? '  [dry-run]' : ' '

    console.log(`${prefix} ${deleted} demande(s) visiteur non confirmée(s) depuis ${UNCONFIRMED_CONTACT_RETENTION_DAYS} j supprimée(s)`)
    console.log(`${prefix} ${anonymized} demande(s) de plus de ${CONTACT_RETENTION_DAYS} j anonymisée(s)`)
    console.log(`${prefix} ${dossiersPurged} dossier(s) DossierFacile supprimé(s) (documents et candidatures emportés)`)

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: { deleted, anonymized, dossiersPurged },
        })
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
