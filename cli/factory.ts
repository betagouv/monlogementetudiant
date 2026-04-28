import { eq } from 'drizzle-orm'
import type { TImportJobType } from '~/schemas/import-jobs'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import type { ImportCommand, ImportOptions, ImportResult, SyncCommand, SyncOptions, SyncResult } from './types'

type ImportLoader = () => Promise<{ default: ImportCommand }>
type SyncLoader = () => Promise<{ default: SyncCommand }>

const importRegistry = new Map<string, ImportLoader>()
const syncRegistry = new Map<string, SyncLoader>()

export function registerImport(name: string, loader: ImportLoader) {
  importRegistry.set(name, loader)
}

export function registerSync(name: string, loader: SyncLoader) {
  syncRegistry.set(name, loader)
}

// Register all commands
registerImport('arpej-ibail', () => import('./commands/import-arpej-ibail'))
registerImport('fac-habitat', () => import('./commands/import-fac-habitat'))
registerImport('csv', () => import('./commands/import-csv'))
registerImport('crous', () => import('./commands/import-crous'))
registerImport('initiall', () => import('./commands/import-initiall'))
registerSync('cities', () => import('./commands/sync-cities'))
registerSync('rents', () => import('./commands/sync-rents'))
registerSync('students', () => import('./commands/sync-students'))
registerSync('stats', () => import('./commands/sync-stats'))

export async function runImport(type: string, options: ImportOptions): Promise<void> {
  const loader = importRegistry.get(type)
  if (!loader) {
    console.error(`✗ Import inconnu : "${type}". Disponibles : ${[...importRegistry.keys()].join(', ')}`)
    process.exit(1)
  }

  const { default: command } = await loader()
  console.log(`→ ${command.description}`)
  if (options.dryRun) console.log('  (mode dry-run)')

  let jobId: number | null = null

  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: type as TImportJobType, status: 'running', source: type, createdBy: 'cron', startedAt: new Date() })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const result: ImportResult = await command.execute(options)
    console.log(`\n✅ Import terminé :`)
    console.log(`  📦 Créés : ${result.created}`)
    console.log(`  🔄 Mis à jour : ${result.updated}`)
    console.log(`  ⏭️ Ignorés : ${result.skipped}`)
    if (result.errors.length > 0) {
      console.log(`  ❌ Erreurs (${result.errors.length}) :`)
      for (const err of result.errors) console.log(`    - ${err}`)
    }

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            ownerName: result.ownerName,
            ownerId: result.ownerId,
            residences: result.residences,
          },
        })
        .where(eq(importJobs.id, jobId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Import échoué : ${msg}`)
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

export async function runSync(type: string, options: SyncOptions): Promise<void> {
  const loader = syncRegistry.get(type)
  if (!loader) {
    console.error(`✗ Sync inconnue : "${type}". Disponibles : ${[...syncRegistry.keys()].join(', ')}`)
    process.exit(1)
  }

  const { default: command } = await loader()
  console.log(`→ ${command.description}`)
  if (options.dryRun) console.log('  (mode dry-run)')

  const jobType = `sync-${type}` as TImportJobType
  let jobId: number | null = null

  if (!options.dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: jobType, status: 'running', source: type, createdBy: 'cron', startedAt: new Date() })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    const result: SyncResult = await command.execute(options)
    console.log(`\n✅ Sync terminée :`)
    console.log(`  🔄 Mis à jour : ${result.updated}`)
    console.log(`  ⏭️ Ignorés : ${result.skipped}`)
    if (result.errors.length > 0) {
      console.log(`  ❌ Erreurs (${result.errors.length}) :`)
      for (const err of result.errors) console.log(`    - ${err}`)
    }

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: {
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            context: result.context,
          },
        })
        .where(eq(importJobs.id, jobId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Sync échouée : ${msg}`)
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
