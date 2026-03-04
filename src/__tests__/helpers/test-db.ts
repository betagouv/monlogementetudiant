import { execSync } from 'node:child_process'
import { sql as drizzleSql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/db/schema'

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST || 'postgres://test:test@localhost:5434/mle_test'

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null
let testConn: postgres.Sql | null = null

export function getTestDb() {
  if (!testDb) {
    testConn = postgres(DATABASE_URL_TEST, { prepare: false })
    testDb = drizzle(testConn, { schema })
  }
  return testDb
}

export async function setupTestDb() {
  execSync(`DATABASE_URL="${DATABASE_URL_TEST}" npx drizzle-kit migrate`, {
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
      "user",
      "session",
      "account",
      "verification"
    RESTART IDENTITY CASCADE
  `)
}
