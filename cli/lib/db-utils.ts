import { execSync } from 'child_process'
import postgres from 'postgres'

export async function cleanDatabase(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false })

  // Drop all tables in public schema (exclude PostGIS system tables)
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('spatial_ref_sys')
  `
  if (tables.length > 0) {
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ')
    await sql.unsafe(`DROP TABLE IF EXISTS ${tableNames} CASCADE`)
    console.log(`  ✓ ${tables.length} tables supprimées`)
  }

  // Drop all custom enum types
  const enums = await sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  `
  for (const e of enums) {
    await sql.unsafe(`DROP TYPE IF EXISTS "${e.typname}" CASCADE`)
  }
  if (enums.length > 0) {
    console.log(`  ✓ ${enums.length} types enum supprimés`)
  }

  // Drop all custom functions (e.g. immutable_unaccent from prod backup)
  // Exclude functions that belong to extensions (like PostGIS)
  const functions = await sql`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
      )
  `
  for (const f of functions) {
    await sql.unsafe(`DROP FUNCTION IF EXISTS "public"."${f.proname}"(${f.args}) CASCADE`)
  }
  if (functions.length > 0) {
    console.log(`  ✓ ${functions.length} fonctions supprimées`)
  }

  await sql.end()
}

export async function ensureExtensions(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false })

  const extensions = ['postgis', 'postgis_topology', 'postgis_tiger_geocoder', 'unaccent', 'pg_trgm']
  for (const ext of extensions) {
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "${ext}" CASCADE`)
  }
  console.log(`  ✓ Extensions installées: ${extensions.join(', ')}`)

  await sql.end()
}

export function restoreBackup(databaseUrl: string, dumpPath: string): void {
  try {
    execSync(
      `pg_restore --clean --if-exists --no-owner --no-privileges -d "${databaseUrl}" "${dumpPath}"`,
      { stdio: 'inherit' }
    )
  } catch {
    // pg_restore often exits with non-zero even on success (warnings about pre-existing objects)
    console.log('  ⚠ Avertissements pg_restore ignorés (normal)')
  }
}
