import { execSync } from 'child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { ScalingoBackupService } from '../lib/scalingo-backup'
import { cleanDatabase, ensureExtensions, restoreBackup } from '../lib/db-utils'

const BACKUP_DIR = '/tmp/jde-backup'

interface ImportBackupOpts {
  backupPath?: string
  skipDownload?: boolean
}

export async function importBackup(opts: ImportBackupOpts) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('✗ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log("✓ Variables d'environnement chargées")

  let archivePath: string

  if (opts.backupPath) {
    if (!existsSync(opts.backupPath)) {
      console.error(`✗ Backup file not found: ${opts.backupPath}`)
      process.exit(1)
    }
    archivePath = opts.backupPath
  } else if (opts.skipDownload) {
    const tarFile = path.join(BACKUP_DIR, 'backup.tar.gz')
    if (!existsSync(tarFile)) {
      console.error(`✗ No backup found at ${tarFile}. Run without --skip-download first.`)
      process.exit(1)
    }
    archivePath = tarFile
  } else {
    console.log('→ Authentification Scalingo...')
    const scalingo = new ScalingoBackupService()
    await scalingo.authenticate()
    console.log('✓ Authentification réussie')

    console.log('→ Récupération de la liste des backups Scalingo...')
    archivePath = await scalingo.downloadLatestBackup(BACKUP_DIR)
  }

  const archiveStats = statSync(archivePath)
  console.log(`✓ Backup prêt : ${archivePath} (${(archiveStats.size / 1024 / 1024).toFixed(2)} MB)`)

  // Extract the archive
  const extractDir = path.join(BACKUP_DIR, 'extracted')
  await mkdir(extractDir, { recursive: true })
  console.log('→ Extraction du backup...')
  execSync(`tar xzf "${archivePath}" -C "${extractDir}"`)

  // Find the .pgsql or .dump file
  const dumpFile = findDumpFile(extractDir)
  if (!dumpFile) {
    console.error('✗ Aucun fichier .pgsql ou .dump trouvé dans le backup')
    process.exit(1)
  }

  const dumpStats = statSync(dumpFile)
  console.log(`✓ Backup extrait : ${dumpFile} (${(dumpStats.size / 1024 / 1024).toFixed(2)} MB)`)

  // Clean the local database
  console.log('→ Nettoyage de la base de données locale...')
  await cleanDatabase(databaseUrl)
  console.log('✓ Tables, enums et fonctions supprimés')

  // Ensure required extensions are installed before restore
  console.log('→ Installation des extensions PostgreSQL...')
  await ensureExtensions(databaseUrl)

  // Restore the backup
  console.log('→ Restauration du backup...')
  restoreBackup(databaseUrl, dumpFile)
  console.log('✓ Backup restauré avec succès')

  // Apply Drizzle migrations to bring schema up to date
  console.log('→ Application des migrations Drizzle...')
  const migrationConn = postgres(databaseUrl, { prepare: false, max: 1 })
  const db = drizzle(migrationConn)
  await migrate(db, { migrationsFolder: './drizzle' })
  await migrationConn.end()
  console.log('✓ Migrations appliquées')

  // Clean up extracted files (keep the archive for --skip-download)
  rmSync(extractDir, { recursive: true, force: true })
  console.log('✓ Fichiers temporaires supprimés')

  console.log('\n✓ Import terminé !')
}

function findDumpFile(dir: string): string | null {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findDumpFile(fullPath)
      if (found) return found
    } else if (entry.name.endsWith('.pgsql') || entry.name.endsWith('.dump')) {
      return fullPath
    }
  }
  return null
}
