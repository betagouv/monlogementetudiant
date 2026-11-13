import { spawnSync } from 'child_process'
import { openSync } from 'fs'
import postgres from 'postgres'

export async function cleanDatabase(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 10, connection: { application_name: 'mle-cli:db-utils' } })

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

  // Drop custom text search configurations (e.g. french_unaccent from prod)
  const tsConfigs = await sql`
    SELECT cfgname FROM pg_ts_config
    WHERE cfgnamespace = 'public'::regnamespace
  `
  for (const c of tsConfigs) {
    await sql.unsafe(`DROP TEXT SEARCH CONFIGURATION IF EXISTS "public"."${c.cfgname}" CASCADE`)
  }
  if (tsConfigs.length > 0) {
    console.log(`  ✓ ${tsConfigs.length} text search configs supprimées`)
  }

  // Drop non-PostGIS extensions so ensureExtensions can recreate them cleanly
  // (avoids stale state where extension "exists" but its functions were dropped)
  await sql.unsafe(`DROP EXTENSION IF EXISTS "unaccent" CASCADE`)
  await sql.unsafe(`DROP EXTENSION IF EXISTS "pg_trgm" CASCADE`)
  console.log('  ✓ Extensions unaccent/pg_trgm supprimées')

  // Drop the drizzle schema entirely so pg_restore can recreate it from the dump.
  // Otherwise __drizzle_migrations from a previous import survives, conflicts on
  // restore (PK / sequence collisions), and the local tracker drifts from the dump.
  await sql.unsafe(`DROP SCHEMA IF EXISTS "drizzle" CASCADE`)
  console.log('  ✓ Schéma drizzle supprimé')

  await sql.end()
}

export async function ensureExtensions(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 10, connection: { application_name: 'mle-cli:db-utils' } })

  const extensions = ['postgis', 'postgis_topology', 'postgis_tiger_geocoder', 'unaccent', 'pg_trgm']
  for (const ext of extensions) {
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "${ext}" CASCADE`)
  }
  console.log(`  ✓ Extensions installées: ${extensions.join(', ')}`)

  await sql.end()
}

/**
 * Répare les deux index que `pg_restore` ne peut pas construire.
 *
 * Le dump définit `immutable_unaccent(text)` comme `SELECT unaccent($1)`, sans
 * qualifier le schéma. `pg_dump` restaure avec `search_path = ''` : au moment
 * de construire un index sur cette fonction, le planificateur l'inline et ne
 * résout plus `unaccent`. Les deux index de recherche sur les noms de communes
 * échouent donc systématiquement, et la base locale tourne sans eux.
 *
 * On requalifie la fonction — même sémantique, mais insensible au search_path —
 * puis on recrée les index manquants.
 */
export async function repairUnaccentIndexes(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 10, connection: { application_name: 'mle-cli:db-utils' } })

  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT public.unaccent($1) $$
  `)

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_cities_name_trgm
       ON public.city USING gin (public.immutable_unaccent((name)::text) public.gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_cities_name_unaccent
       ON public.city USING btree (lower(public.immutable_unaccent((name)::text)))`,
  ]
  for (const statement of indexes) await sql.unsafe(statement)

  console.log('  ✓ Fonction immutable_unaccent requalifiée et index de recherche recréés')
  await sql.end()
}

const PG_CLIENT_IMAGE = 'postgres:18-alpine'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function toDockerReachableUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  if (!LOCAL_HOSTNAMES.has(url.hostname)) return databaseUrl
  url.hostname = 'host.docker.internal'
  return url.toString()
}

export function restoreBackup(databaseUrl: string, dumpPath: string): void {
  const result = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-i',
      '--add-host=host.docker.internal:host-gateway',
      PG_CLIENT_IMAGE,
      'pg_restore',
      '--no-owner',
      '--no-privileges',
      '-d',
      toDockerReachableUrl(databaseUrl),
    ],
    { stdio: [openSync(dumpPath, 'r'), 'inherit', 'pipe'], encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )

  if (result.error) throw new Error(`Impossible de lancer docker : ${result.error.message}`)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status === 0) return
  if (result.status === 1 && /errors ignored on restore: \d+/.test(result.stderr)) {
    console.log('  ⚠ Avertissements pg_restore ignorés (normal)')
    return
  }
  throw new Error(`pg_restore interrompu ou en échec (code ${result.status ?? result.signal})`)
}
