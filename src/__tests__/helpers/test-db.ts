import { execSync } from 'node:child_process'
import { sql as drizzleSql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/db/schema'

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST || 'postgres://test:test@localhost:5491/mle_test'

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null
let testConn: postgres.Sql | null = null

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getTestDb() {
  if (!testDb) {
    testConn = postgres(DATABASE_URL_TEST, { prepare: false })
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

export async function setupTestDb() {
  await waitForTestDatabase()

  execSync(`DATABASE_URL="${DATABASE_URL_TEST}" ./node_modules/.bin/drizzle-kit migrate`, {
    cwd: process.cwd(),
    stdio: 'pipe',
  })
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
      territories_academy,
      territories_department,
      territories_city,
      accommodation_accommodation,
      account_owner,
      accommodation_externalsource,
      accommodation_favoriteaccommodation,
      newsletter_subscription,
      student_alert,
      stats_stats,
      stats_eventstats,
      dossier_facile_tenant,
      dossier_facile_application,
      "user",
      "session",
      "account",
      "verification"
    RESTART IDENTITY CASCADE
  `)
}
