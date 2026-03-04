import type { ImportCommand, ImportOptions, ImportResult, SyncCommand, SyncOptions, SyncResult } from './types'
import { closeDb } from './lib/db'

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

  try {
    const result: SyncResult = await command.execute(options)
    console.log(`\n✅ Sync terminée :`)
    console.log(`  🔄 Mis à jour : ${result.updated}`)
    console.log(`  ⏭️ Ignorés : ${result.skipped}`)
    if (result.errors.length > 0) {
      console.log(`  ❌ Erreurs (${result.errors.length}) :`)
      for (const err of result.errors) console.log(`    - ${err}`)
    }
  } finally {
    await closeDb()
  }
}
