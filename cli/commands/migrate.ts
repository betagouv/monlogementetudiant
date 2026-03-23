import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import { closeDb, db } from '../lib/db'

export async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log('→ Application des migrations Drizzle...')

  try {
    await runMigrations(db, { migrationsFolder: './drizzle' })
    console.log('✓ Migrations Drizzle appliquées')
  } finally {
    await closeDb()
  }
}
