import { eq } from 'drizzle-orm'
import { captureAvailabilitySnapshot, loadAvailabilityByOwner } from '~/server/admin/availability-follow-up'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'

interface CaptureAvailabilitySnapshotOptions {
  dryRun?: boolean
}

export async function captureAvailabilitySnapshotCommand(options: CaptureAvailabilitySnapshotOptions): Promise<void> {
  console.log('⏳ Relevé du suivi des disponibilités...')

  if (options.dryRun) {
    try {
      const rows = await loadAvailabilityByOwner()
      console.log(`\n  [dry-run] ${rows.length} gestionnaire(s) seraient relevés`)
    } finally {
      await closeDb()
    }
    return
  }

  const [job] = await db
    .insert(importJobs)
    .values({
      type: 'availability-snapshot',
      status: 'running',
      source: 'availability-snapshot',
      createdBy: 'cron',
      startedAt: new Date(),
    })
    .returning({ id: importJobs.id })

  try {
    const { capturedOn, owners } = await captureAvailabilitySnapshot()
    console.log(`\n  Relevé du ${capturedOn} : ${owners} gestionnaire(s)`)

    await db
      .update(importJobs)
      .set({
        status: 'done',
        endedAt: new Date(),
        updatedAt: new Date(),
        summary: { errors: [], context: { capturedOn, owners } },
      })
      .where(eq(importJobs.id, job.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Relevé du suivi des disponibilités échoué : ${msg}`)
    await db
      .update(importJobs)
      .set({ status: 'error', endedAt: new Date(), updatedAt: new Date(), summary: { errors: [msg] } })
      .where(eq(importJobs.id, job.id))
    throw error
  } finally {
    await closeDb()
  }
}
