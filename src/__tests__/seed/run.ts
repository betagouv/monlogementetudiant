/**
 * Lanceur commun du seed : vérifie la cible, crée la base si besoin, applique les migrations,
 * VIDE toutes les tables puis insère le jeu de données partagé (./dataset.ts).
 *
 * Deux connexions visent la même base : `DATABASE_URL_TEST` (factories, via getTestDb) et
 * `DATABASE_URL` (code de production rejoué par le seed : métriques, purge). Les deux sont vérifiées.
 */
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { closeDb } from '../../server/db'
import { cleanTables, getTestDb, setupTestDb, teardownTestDb } from '../helpers/test-db'
import { SEED_PASSWORD } from './accounts'
import { SEED_ACCOUNTS, seedDataset } from './dataset'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const SEEDABLE_DB_NAME = /_(dev|e2e|test)$/

/**
 * Le seed commence par un TRUNCATE de toutes les tables : on refuse toute base qui ne soit pas
 * à la fois locale ET nommée comme une base jetable. Le nom compte autant que l'hôte : un tunnel
 * peut exposer une base distante sur 127.0.0.1.
 */
export function assertSeedableDatabase(rawUrl: string | undefined): URL {
  if (!rawUrl) throw new Error('DATABASE_URL_TEST non définie : impossible de déterminer la base à seeder.')
  const url = new URL(rawUrl)
  const dbName = url.pathname.slice(1)
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Seed refusé : la base doit être locale (hôte reçu : ${url.hostname}).`)
  }
  if (!SEEDABLE_DB_NAME.test(dbName)) {
    throw new Error(`Seed refusé : le nom de la base doit finir par _dev, _e2e ou _test (reçu : ${dbName}).`)
  }
  return url
}

async function ensureDatabaseExists(url: URL) {
  const dbName = url.pathname.slice(1)
  const conn = postgres(new URL('/postgres', url).toString(), { max: 1 })
  try {
    const exists = await conn`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
    if (exists.length === 0) await conn.unsafe(`CREATE DATABASE "${dbName}"`)
  } finally {
    await conn.end()
  }
}

/** Les deux URL doivent désigner la même base : le seed écrit par les deux connexions. */
export function assertSameDatabase(a: URL, b: URL) {
  const key = (url: URL) => `${url.hostname}:${url.port || '5432'}/${url.pathname.slice(1)}`
  if (key(a) !== key(b)) {
    throw new Error(`Seed refusé : DATABASE_URL (${key(b)}) et DATABASE_URL_TEST (${key(a)}) désignent des bases différentes.`)
  }
}

export async function runSeed(label: string) {
  const url = assertSeedableDatabase(process.env.DATABASE_URL_TEST)
  assertSameDatabase(url, assertSeedableDatabase(process.env.DATABASE_URL))
  const dbName = url.pathname.slice(1)
  const startedAt = Date.now()

  try {
    await ensureDatabaseExists(url)
    await setupTestDb()
    await cleanTables()
    // Tables sans lien vers user/owner/accommodation, absentes de cleanTables (propre aux tests d'intégration).
    await getTestDb().execute(sql`TRUNCATE TABLE import_job RESTART IDENTITY`)
    await seedDataset()
  } finally {
    await teardownTestDb()
    await closeDb()
  }

  console.log(`Seed ${label} OK (base ${dbName}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s)`)
  console.log(`Comptes (mot de passe : ${SEED_PASSWORD}) :`)
  for (const [role, email] of Object.entries(SEED_ACCOUNTS)) console.log(`  - ${role.padEnd(12)} ${email}`)
}
