import { migrate as runDrizzleMigrations } from 'drizzle-orm/postgres-js/migrator'
import { runMigrations as runGraphileMigrations } from 'graphile-worker'
import { closeDb, db } from '~/server/db'
import { env } from '~/server/env'

export async function migrate() {
  console.log('→ Application des migrations Drizzle...')

  try {
    await runDrizzleMigrations(db, { migrationsFolder: './drizzle' })
    console.log('✓ Migrations Drizzle appliquées')

    console.log('→ Application des migrations graphile-worker...')
    await runGraphileMigrations({ connectionString: env.DATABASE_URL })
    console.log('✓ Migrations graphile-worker appliquées')
  } finally {
    await closeDb()
  }
}
