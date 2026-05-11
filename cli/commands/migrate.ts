import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import { closeDb, db } from '~/server/db'

export async function migrate() {
  console.log('→ Application des migrations Drizzle...')

  try {
    await runMigrations(db, { migrationsFolder: './drizzle' })
    console.log('✓ Migrations Drizzle appliquées')
  } finally {
    await closeDb()
  }
}
