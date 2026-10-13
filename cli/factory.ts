import { eq, inArray } from 'drizzle-orm'
import type { TImportJobType } from '~/schemas/import-jobs'
import { closeDb, db } from '~/server/db'
import { accommodations, importJobs } from '~/server/db/schema'
import { detectAlertJobs } from '~/server/services/alert-detector'
import { CronPartialFailure } from './cron-failure'
import { captureCliException } from './sentry'
import type { ImportCommand, ImportOptions, ImportResult, SyncCommand, SyncOptions, SyncResult } from './types'

// Imports qui écrivent la disponibilité (`nb_t*_available`) : après leur passage, on
// déclenche une détection scopée pour notifier les hausses sans attendre le cron. Les
// autres imports (sans dispo) et les chemins oubliés restent couverts par le cron de
// réconciliation, qui sert de filet de sécurité.
const IMPORTS_WRITING_AVAILABILITY = new Set(['arpej-ibail', 'fac-habitat'])

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
  // Échec partiel : levé après le `finally`, pour ne pas repasser par le `catch` ci-dessous
  // qui écraserait le statut `done` et son résumé détaillé.
  let partialFailure: CronPartialFailure | null = null

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

    if (!options.dryRun && IMPORTS_WRITING_AVAILABILITY.has(type) && result.residences?.length) {
      try {
        const slugs = result.residences.map((r) => r.slug)
        const touched = await db.select({ id: accommodations.id }).from(accommodations).where(inArray(accommodations.slug, slugs))
        const { triggered, jobsCreated } = await detectAlertJobs({ accommodationIds: touched.map((t) => t.id) })
        console.log(`  🔔 Détection alertes : ${triggered} hausse(s), ${jobsCreated} job(s) créé(s)`)
      } catch (error) {
        console.error('  ⚠️ Détection alertes après import échouée :', error instanceof Error ? error.message : String(error))
        await captureCliException(error)
      }
    }

    // Le run a abouti et le job est marqué `done`, mais des éléments sont passés à la trappe :
    // on sort quand même en échec pour que le cron le signale (mail + Sentry + Scalingo).
    if (result.errors.length > 0) {
      partialFailure = new CronPartialFailure(`Import ${type} : ${result.errors.length} erreur(s) sur des éléments`, result.errors)
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

  if (partialFailure) throw partialFailure
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
  // Voir `runImport` : levé après le `finally` pour préserver le statut `done`.
  let partialFailure: CronPartialFailure | null = null

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

    if (result.errors.length > 0) {
      partialFailure = new CronPartialFailure(`Sync ${type} : ${result.errors.length} erreur(s) sur des éléments`, result.errors)
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

  if (partialFailure) throw partialFailure
}
