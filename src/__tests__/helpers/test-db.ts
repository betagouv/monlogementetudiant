import { execSync } from 'node:child_process'
import { sql as drizzleSql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/db/schema'

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST || 'postgres://test:test@localhost:5491/mle_test'

/**
 * Chaque worker Vitest (`VITEST_POOL_ID`, de 1 à maxWorkers) travaille sur sa propre base, clonée de la base
 * migrée par le global setup : les fichiers d'intégration peuvent ainsi tourner en parallèle sans se
 * partager de tables. Hors worker (global setup, scripts), on reste sur la base de référence.
 */
export function workerDatabaseUrl(poolId = process.env.VITEST_POOL_ID) {
  if (!poolId) return DATABASE_URL_TEST
  const url = new URL(DATABASE_URL_TEST)
  url.pathname = `${url.pathname}_w${poolId}`
  return url.toString()
}

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null
let testConn: postgres.Sql | null = null

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getTestDb() {
  if (!testDb) {
    testConn = postgres(workerDatabaseUrl(), { prepare: false, max: 5, idle_timeout: 30, connection: { application_name: 'mle-test' } })
    testDb = drizzle(testConn, { schema })
  }
  return testDb
}

async function waitForTestDatabase(maxAttempts = 30, delayMs = 1000) {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const conn = postgres(DATABASE_URL_TEST, { prepare: false, max: 1 })
    try {
      await conn`select 1`
      await conn.end()
      return
    } catch (error) {
      lastError = error
      await conn.end({ timeout: 1 })
      if (attempt < maxAttempts) {
        await sleep(delayMs)
      }
    }
  }

  throw new Error(`Database is not reachable at ${DATABASE_URL_TEST}`, { cause: lastError })
}

/** Migre la base de référence ; avec `workerCount`, la clone ensuite pour chaque worker Vitest (tests d'intégration). */
export async function setupTestDb(workerCount = 0) {
  await waitForTestDatabase()

  execSync(`DATABASE_URL="${DATABASE_URL_TEST}" ./node_modules/.bin/drizzle-kit migrate`, {
    cwd: process.cwd(),
    stdio: 'pipe',
  })

  execSync(`./node_modules/.bin/graphile-worker --schema-only -c "${DATABASE_URL_TEST}"`, {
    cwd: process.cwd(),
    stdio: 'pipe',
  })

  await createWorkerDatabases(workerCount)
}

/** (Re)crée une base par worker à partir de la base migrée, qui sert de modèle (`CREATE DATABASE … TEMPLATE`). */
async function createWorkerDatabases(workerCount: number) {
  const template = new URL(DATABASE_URL_TEST).pathname.slice(1)
  const admin = new URL(DATABASE_URL_TEST)
  admin.pathname = '/postgres'
  const conn = postgres(admin.toString(), { prepare: false, max: 1 })
  try {
    for (let poolId = 1; poolId <= workerCount; poolId++) {
      const name = new URL(workerDatabaseUrl(String(poolId))).pathname.slice(1)
      await conn.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      await conn.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}"`)
    }
  } finally {
    await conn.end()
  }
}

export async function teardownTestDb() {
  if (testConn) {
    await testConn.end()
    testConn = null
    testDb = null
  }
}

export async function cleanTables() {
  const db = getTestDb()
  await db.execute(drizzleSql`
    TRUNCATE TABLE
      activity_log,
      job_run,
      application_fact,
      monthly_metric,
      academy,
      department,
      city,
      accommodation,
      admin_owner_link,
      bailleur_accommodation_scope,
      owner,
      external_source,
      import_blocklist,
      login_attempt,
      reminder_email_item,
      reminder_email,
      favorite_accommodation,
      housing_aid_simulation,
      newsletter_subscription,
      student_alert,
      stats,
      event_stat,
      tracking_event,
      dossier_facile_tenant,
      dossier_facile_application,
      "user",
      "session",
      "account",
      "verification"
    RESTART IDENTITY CASCADE
  `)
  await db.execute(drizzleSql`TRUNCATE TABLE graphile_worker._private_jobs, graphile_worker._private_job_queues RESTART IDENTITY CASCADE`)
}
