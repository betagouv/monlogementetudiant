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
    testConn = postgres(DATABASE_URL_TEST, { prepare: false, max: 5, idle_timeout: 30, connection: { application_name: 'mle-test' } })
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
      academy,
      department,
      city,
      accommodation,
      admin_owner_link,
      owner,
      external_source,
      import_blocklist,
      login_attempt,
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
}
